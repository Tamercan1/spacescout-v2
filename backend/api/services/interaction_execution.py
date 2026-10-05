import logging
from django.utils import timezone
from api.models import Interaction
from api.engine.contracts import OrchestratorContext, OrchestratorErrorCode
from api.engine.orchestrator import GenericOrchestrator
from api.engine.providers.openrouter import OpenRouterProvider
from api.engine.tool_registry_v2 import registry as tool_registry
from api.services.result_persistence import ResultPersistenceService

logger = logging.getLogger(__name__)

def execute_interaction(interaction: Interaction):
    """
    Executes the interaction workflow using the generic orchestration pipeline.
    This runs synchronously.
    """
    # Atomically update status to processing to prevent concurrent duplicate runs
    updated = Interaction.objects.filter(id=interaction.id, status="pending").update(status="processing")
    if not updated:
        logger.warning(f"Interaction {interaction.id} is not in pending state or already executing. Skipping execution to prevent duplicates.")
        return
        
    # Manually update the in-memory object since .update() only affects the DB
    interaction.status = "processing"

    try:
        user = interaction.space_plan.user

        # Prepare Context
        targets = []
        for d in interaction.target_discoveries.all():
            targets.append({
                "id": d.id,
                "title": d.title,
                "summary": d.summary,
                "source": d.source,
                "type": d.type,
            })

        existing = []
        for d in interaction.space_plan.discoveries.all()[:15]:
            existing.append({
                "id": d.id,
                "title": d.title,
                "summary": d.summary,
                "source": d.source,
                "type": d.type,
            })

        preferred_model = ""
        if hasattr(user, 'profile') and user.profile.preferred_model:
            preferred_model = user.profile.preferred_model

        context = OrchestratorContext(
            user_id=user.id,
            space_plan_id=interaction.space_plan.id,
            space_plan_title=interaction.space_plan.title,
            space_plan_summary=interaction.space_plan.summary,
            interaction_id=str(interaction.id),
            user_prompt=interaction.user_prompt,
            interaction_type=interaction.interaction_type,
            target_discoveries=targets,
            existing_discoveries=existing,
            preferred_model=preferred_model
        )

        try:
            provider = OpenRouterProvider(user_id=user.id)
        except Exception as e:
            logger.exception("Failed to initialize provider")
            interaction.status = "failed"
            interaction.error_code = OrchestratorErrorCode.UNEXPECTED_ERROR
            interaction.response = {"error": "Failed to initialize provider."}
            interaction.completed_at = timezone.now()
            interaction.save()
            return

        orchestrator = GenericOrchestrator(provider=provider, registry=tool_registry)

        try:
            result = orchestrator.execute(context)
        except Exception as e:
            logger.exception("Unexpected orchestrator crash")
            interaction.status = "failed"
            interaction.error_code = OrchestratorErrorCode.UNEXPECTED_ERROR
            interaction.response = {"error": "An unexpected orchestration error occurred."}
            interaction.completed_at = timezone.now()
            interaction.save()
            return

        try:
            ResultPersistenceService.persist_result(interaction, result, user.id)
        except Exception as e:
            logger.exception("Failed to persist execution result")
            if interaction.status == "processing":
                interaction.status = "failed"
                interaction.error_code = "persistence_failed"
                interaction.response = {"error": "Failed to persist interaction result."}
                interaction.completed_at = timezone.now()
                interaction.save()
            return
            
    except Exception as e:
        logger.exception("Unexpected execution error")
        try:
            interaction.status = "failed"
            interaction.error_code = OrchestratorErrorCode.UNEXPECTED_ERROR
            interaction.response = {"error": "An internal system error occurred during execution."}
            interaction.completed_at = timezone.now()
            interaction.save(update_fields=['status', 'error_code', 'response', 'completed_at'])
        except Exception as fallback_err:
            logger.exception("Failed to save terminal failed state")
