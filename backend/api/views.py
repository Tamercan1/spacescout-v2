from .models import User, SpacePlan, Discovery, Interaction, ProviderCredential
from .app_services.space_plan import save_space_plan
from .engine.space_planner import run_space_planner
from .services.credentials import encrypt_credential, generate_key_hint

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .serializers import (
    UserSerializer, CurrentUserSerializer,
    SpacePlanSerializer, SpacePlanRequestSerializer,
    InteractionSerializer, InteractionCreateSerializer,
    ProviderCredentialReadSerializer, ProviderCredentialWriteSerializer,
)

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

class SpacePlanListView(generics.ListAPIView):
    serializer_class = SpacePlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return SpacePlan.objects.filter(user=user).order_by('-created_at')


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

        # Calling the main space plan engine
        space_plan = run_space_planner(prompt)

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