import logging
from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import User, UserProfile, SpacePlan, Discovery, Interaction, ProviderCredential
from .app_services.space_plan import save_space_plan
from .engine.space_planner import run_space_planner
from .services.credentials import encrypt_credential, generate_key_hint, decrypt_credential
from .services.provider_validation import validate_provider_credential, ValidationStatus
from .serializers import (
    UserSerializer, CurrentUserSerializer, UserProfileSerializer,
    SpacePlanSerializer, SpacePlanRequestSerializer,
    InteractionSerializer, InteractionCreateSerializer,
    ProviderCredentialReadSerializer, ProviderCredentialWriteSerializer,
)

logger = logging.getLogger(__name__)

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]


class CurrentUserView(APIView):
    """Return the authenticated user's account and profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        profile = request.user.profile
        # We allow partial updates to UserProfile via the root of the request data.
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CurrentUserSerializer(request.user).data)


class CompleteOnboardingView(APIView):
    """Mark onboarding as completed for the authenticated user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, "profile", None)
        if profile is None:
            profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if not profile.onboarding_completed_at:
            profile.onboarding_completed_at = timezone.now()
            profile.save(update_fields=["onboarding_completed_at"])
        request.user.profile = profile
        return Response(CurrentUserSerializer(request.user).data, status=status.HTTP_200_OK)


class SpacePlanListView(generics.ListAPIView):
    serializer_class = SpacePlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = SpacePlan.objects.filter(user=user).prefetch_related('discoveries__media')

        # Filter by archived status (?archived=true/false or ?is_archived=true/false)
        archived_param = self.request.query_params.get("archived")
        if archived_param is None:
            archived_param = self.request.query_params.get("is_archived")

        if archived_param is not None:
            val = archived_param.strip().lower()
            if val in ("true", "1"):
                queryset = queryset.filter(is_archived=True)
            elif val in ("false", "0"):
                queryset = queryset.filter(is_archived=False)

        # Filter by status (?status=pending|processing|completed|failed)
        status_param = self.request.query_params.get("status")
        if status_param is not None:
            status_val = status_param.strip().lower()
            valid_statuses = [choice[0] for choice in SpacePlan.STATUS_CHOICES]
            if status_val in valid_statuses:
                queryset = queryset.filter(status=status_val)

        # Search filter (?search=...)
        search_query = self.request.query_params.get("search")
        if search_query:
            query = search_query.strip()
            if query:
                queryset = queryset.filter(
                    Q(title__icontains=query) | Q(summary__icontains=query)
                )

        # Ordering (?ordering=...)
        ordering = self.request.query_params.get("ordering")
        allowed_orderings = {
            "created_at", "-created_at",
            "updated_at", "-updated_at",
            "title", "-title",
        }
        if ordering and ordering.strip() in allowed_orderings:
            queryset = queryset.order_by(ordering.strip())
        else:
            queryset = queryset.order_by("-created_at")

        return queryset


class SpacePlanDetailDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SpacePlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return SpacePlan.objects.filter(user=user)


class SpacePlanCreateView(generics.CreateAPIView):
    serializer_class = SpacePlanRequestSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        prompt = serializer.validated_data["prompt"]

        # Calling the main space plan engine within a targeted error boundary
        try:
            space_plan = run_space_planner(prompt, user=request.user)
        except Exception as exc:
            logger.error("Space planner execution failed: %s", type(exc).__name__)
            return Response(
                {"detail": "Space exploration planner failed to execute. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY
            )

        # Save it to db
        saved_plan = save_space_plan(
            user=request.user,
            prompt=prompt,
            space_plan=space_plan
        )

        response_serializer = SpacePlanSerializer(saved_plan)

        # Respond right away
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED
        )


class InteractionListCreateView(APIView):
    """
    GET  /api/plans/<space_plan_id>/interactions/  — list interactions
    POST /api/plans/<space_plan_id>/interactions/  — create interaction

    Enforces ownership: the authenticated user must own the SpacePlan.
    """
    permission_classes = [IsAuthenticated]

    def _get_space_plan(self, request, space_plan_id):
        """Resolve SpacePlan from URL, enforcing ownership."""
        return get_object_or_404(
            SpacePlan.objects.filter(user=request.user),
            pk=space_plan_id
        )

    def get(self, request, space_plan_id):
        space_plan = self._get_space_plan(request, space_plan_id)
        interactions = Interaction.objects.filter(space_plan=space_plan)
        serializer = InteractionSerializer(interactions, many=True)
        return Response(serializer.data)

    def post(self, request, space_plan_id):
        space_plan = self._get_space_plan(request, space_plan_id)

        serializer = InteractionCreateSerializer(
            data=request.data,
            context={"space_plan": space_plan}
        )
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        target_ids = data.pop("target_discoveries", [])

        interaction = Interaction.objects.create(
            space_plan=space_plan,
            user_prompt=data["user_prompt"],
            interaction_type=data["interaction_type"],
            status="pending",
        )

        if target_ids:
            targets = Discovery.objects.filter(
                space_plan=space_plan, id__in=target_ids
            )
            interaction.target_discoveries.set(targets)

        # Execute synchronously
        from .services.interaction_execution import execute_interaction
        execute_interaction(interaction)
        
        # Refresh to get updated status and response
        interaction.refresh_from_db()

        response_serializer = InteractionSerializer(interaction)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED
        )

# ============================================================
# CREDENTIAL VIEWS
# ============================================================

class ProviderCredentialListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        credentials = ProviderCredential.objects.filter(user=request.user)
        serializer = ProviderCredentialReadSerializer(credentials, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ProviderCredentialWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        provider = serializer.validated_data["provider"]
        raw_key = serializer.validated_data["raw_key"]
        
        encrypted_key = encrypt_credential(raw_key)
        key_hint = generate_key_hint(raw_key)
        
        credential, created = ProviderCredential.objects.update_or_create(
            user=request.user,
            provider=provider,
            defaults={
                "encrypted_key": encrypted_key,
                "key_hint": key_hint,
                "is_valid": None,
                "last_validated_at": None,
            }
        )
        
        response_serializer = ProviderCredentialReadSerializer(credential)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(response_serializer.data, status=status_code)


class ProviderCredentialDestroyView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, provider):
        valid_providers = [choice[0] for choice in ProviderCredential.PROVIDER_CHOICES]
        if provider not in valid_providers:
            return Response(status=status.HTTP_404_NOT_FOUND)

        deleted, _ = ProviderCredential.objects.filter(user=request.user, provider=provider).delete()
        if deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(status=status.HTTP_404_NOT_FOUND)


class ProviderCredentialValidateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, provider):
        valid_providers = [choice[0] for choice in ProviderCredential.PROVIDER_CHOICES]
        if provider not in valid_providers:
            return Response({"detail": "Unsupported provider."}, status=status.HTTP_400_BAD_REQUEST)

        credential = get_object_or_404(ProviderCredential, user=request.user, provider=provider)
        
        try:
            raw_key = decrypt_credential(credential.encrypted_key)
        except Exception:
            return Response({"detail": "Credential configuration error. Please re-enter your key."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        validation_result = validate_provider_credential(provider, raw_key)
        
        # We explicitly clear raw_key from memory as soon as we're done
        del raw_key
        
        if validation_result["status"] == ValidationStatus.VALID:
            credential.is_valid = True
            credential.last_validated_at = timezone.now()
            credential.save(update_fields=['is_valid', 'last_validated_at'])
            return Response({
                "provider": provider,
                "is_valid": True,
                "validated_at": credential.last_validated_at
            })
            
        elif validation_result["status"] == ValidationStatus.INVALID:
            credential.is_valid = False
            credential.last_validated_at = timezone.now()
            credential.save(update_fields=['is_valid', 'last_validated_at'])
            return Response({
                "provider": provider,
                "is_valid": False,
                "validated_at": credential.last_validated_at,
                "detail": validation_result["detail"]
            })
            
        else: # TRANSIENT_ERROR
            # We do NOT update is_valid for transient errors to avoid resetting a previously valid state
            return Response({
                "provider": provider,
                "is_valid": credential.is_valid,
                "validated_at": credential.last_validated_at,
                "detail": validation_result["detail"]
            }, status=status.HTTP_502_BAD_GATEWAY)