from django.urls import path
from .views import (
    CreateUserView, CurrentUserView,
    SpacePlanListView, SpacePlanDetailDestroyView, SpacePlanCreateView,
    InteractionListCreateView,
    ProviderCredentialListCreateView, ProviderCredentialDestroyView,
    ProviderCredentialValidateView
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("register/", CreateUserView.as_view(), name="index"),
    path("auth/token/", TokenObtainPairView.as_view(), name="access_token"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="refresh_token"),
    path("auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("plans/", SpacePlanListView.as_view(), name="space_plans"),
    path("plans/<int:pk>/", SpacePlanDetailDestroyView.as_view(), name="space_plan_detail_view"),
    path("plans/create/", SpacePlanCreateView.as_view(), name='space_plan_create_view'),
    path("plans/<int:space_plan_id>/interactions/", InteractionListCreateView.as_view(), name="interaction_list_create"),
    path("credentials/", ProviderCredentialListCreateView.as_view(), name="credential_list_create"),
    path("credentials/<str:provider>/", ProviderCredentialDestroyView.as_view(), name="credential_destroy"),
    path("credentials/<str:provider>/validate/", ProviderCredentialValidateView.as_view(), name="credential_validate"),
]