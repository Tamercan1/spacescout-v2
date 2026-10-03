from .models import User, UserProfile, SpacePlan, Discovery, DiscoveryMedia, Interaction
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "password"]
        extra_kwargs = {"password": {"write_only": True, "required": True}}

    def validate_username(self, value):
        if len(value) < 4:
            raise serializers.ValidationError("Username must be at least 4 characters long.")
        return value

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
            
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password']
        )
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["preferred_model", "theme", "onboarding_completed_at"]
        read_only_fields = ["onboarding_completed_at"]


class CurrentUserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "profile"]
        read_only_fields = ["id", "username"]


class DiscoveryMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscoveryMedia
        fields = [
            "id", "media_type", "url", "thumbnail_url",
            "caption", "is_primary", "order"
        ]


class DiscoverySerializer(serializers.ModelSerializer):
    media = DiscoveryMediaSerializer(many=True, read_only=True)

    class Meta:
        model = Discovery
        fields = [
            "id", "source", "external_id", "source_url",
            "type", "title", "date",
            "summary", "why_interesting",
            "facts", "tags", "details", "sort_order",
            "media",
            "first_discovered_at", "updated_at",
        ]

# Main DB Serializer
class SpacePlanSerializer(serializers.ModelSerializer):
    discoveries = DiscoverySerializer(many=True, read_only=True)

    class Meta:
        model = SpacePlan
        fields = [
            "id", "prompt", "title", "summary", "status", "is_archived",
            "discoveries", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "prompt", "summary", "status", "created_at", "updated_at"]


# User prompt serializer
class SpacePlanRequestSerializer(serializers.Serializer):
    prompt = serializers.CharField(
        max_length=2000,
        allow_blank=False,
        trim_whitespace=True,
    )


# ============================================================
# INTERACTION SERIALIZERS
# ============================================================

class InteractionSerializer(serializers.ModelSerializer):
    """Read serializer for Interaction — exposes all fields with server-controlled ones read-only."""
    target_discoveries = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    added_discoveries = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Interaction
        fields = [
            "id", "space_plan", "user_prompt", "interaction_type",
            "status", "response", "error_code",
            "target_discoveries", "added_discoveries",
            "created_at", "completed_at",
        ]
        read_only_fields = [
            "id", "space_plan", "status", "response", "error_code",
            "added_discoveries", "completed_at", "created_at",
        ]


class InteractionCreateSerializer(serializers.Serializer):
    """
    Write serializer for creating an Interaction.
    The space_plan is determined from the URL, not from the client payload.
    target_discoveries are validated to belong to the same SpacePlan.
    """
    user_prompt = serializers.CharField(max_length=5000, allow_blank=False, trim_whitespace=True)
    interaction_type = serializers.ChoiceField(choices=Interaction.INTERACTION_TYPE_CHOICES)
    target_discoveries = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )

    def validate_target_discoveries(self, value):
        if not value:
            return value

        space_plan = self.context.get("space_plan")
        if not space_plan:
            raise serializers.ValidationError("SpacePlan context is required.")

        existing_ids = set(
            Discovery.objects.filter(
                space_plan=space_plan, id__in=value
            ).values_list("id", flat=True)
        )
        invalid_ids = set(value) - existing_ids
        if invalid_ids:
            raise serializers.ValidationError(
                f"Discoveries {list(invalid_ids)} do not belong to this SpacePlan."
            )
        return value