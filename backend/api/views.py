from .models import User, SpacePlan, Discovery, Interaction
from .app_services.space_plan import save_space_plan
from .engine.space_planner import run_space_planner

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .serializers import (
    UserSerializer, CurrentUserSerializer,
    SpacePlanSerializer, SpacePlanRequestSerializer,
    InteractionSerializer, InteractionCreateSerializer,
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