import logging
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from api.models import Interaction, Discovery, DiscoveryMedia
from api.engine.contracts import OrchestratorResult
from api.engine.result_normalizer import ResultNormalizer

logger = logging.getLogger(__name__)

class ResultPersistenceService:
    @staticmethod
    def persist_result(interaction: Interaction, orchestrator_result: OrchestratorResult, user_id: int):
        """
        Persists the orchestrator result into the database.
        Verifies the interaction belongs to the authenticated user.
        """
        if interaction.space_plan.user_id != user_id:
            logger.error("Security violation: Attempted to persist into a SpacePlan belonging to another user.")
            raise PermissionError("SpacePlan does not belong to the current user.")

        normalized_response = ResultNormalizer.normalize(orchestrator_result)
        
        if not orchestrator_result.success:
            interaction.status = "failed"
            interaction.error_code = orchestrator_result.error_code
            interaction.response = normalized_response
            interaction.completed_at = timezone.now()
            interaction.save()
            return
            
        saved_discovery_ids = []
        try:
            with transaction.atomic():
                plan = interaction.space_plan
                
                # Fetch current max sort_order to maintain deterministic ordering
                max_order = Discovery.objects.filter(space_plan=plan).aggregate(Max('sort_order'))['sort_order__max']
                current_sort_order = max_order + 1 if max_order is not None else 0
                
                for d_data in orchestrator_result.discoveries:
                    discovery = None
                    created = False
                    if d_data.external_id:
                        discovery = Discovery.objects.filter(
                            space_plan=plan,
                            source=d_data.source,
                            external_id=d_data.external_id
                        ).first()
                        
                        if discovery:
                            # Update fields but preserve identity, sort_order, and media
                            discovery.summary = d_data.summary
                            discovery.why_interesting = d_data.why_interesting
                            if d_data.facts:
                                discovery.facts = d_data.facts
                            discovery.save()
                        else:
                            discovery = Discovery.objects.create(
                                space_plan=plan,
                                source=d_data.source,
                                external_id=d_data.external_id,
                                type=d_data.source,
                                title=d_data.title,
                                summary=d_data.summary,
                                why_interesting=d_data.why_interesting,
                                date=d_data.date,
                                source_url=d_data.source_url,
                                facts=d_data.facts,
                                details=d_data.details,
                                tags=d_data.tags,
                                sort_order=current_sort_order
                            )
                            current_sort_order += 1
                            created = True
                    else:
                        # No external ID, always create new to avoid false deduplication
                        discovery = Discovery.objects.create(
                            space_plan=plan,
                            source=d_data.source,
                            external_id=None,
                            type=d_data.source,
                            title=d_data.title,
                            summary=d_data.summary,
                            why_interesting=d_data.why_interesting,
                            date=d_data.date,
                            source_url=d_data.source_url,
                            facts=d_data.facts,
                            details=d_data.details,
                            tags=d_data.tags,
                            sort_order=current_sort_order
                        )
                        current_sort_order += 1
                        created = True
                        
                    # Handle Media only on creation to avoid duplicate media attachments
                    if d_data.media and created:
                        for idx, m in enumerate(d_data.media):
                            raw_type = m.get("media_type") or m.get("type")
                            raw_url = (m.get("url") or "").lower()
                            if not raw_type or raw_type == "other":
                                if any(raw_url.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]):
                                    raw_type = "image"
                                elif any(k in raw_url for k in ["youtube.com", "youtu.be", "vimeo.com", ".mp4", ".webm", ".mov"]):
                                    raw_type = "video"
                                else:
                                    raw_type = "image" if raw_url else "other"

                            DiscoveryMedia.objects.create(
                                discovery=discovery,
                                media_type=raw_type,
                                url=m.get("url", ""),
                                thumbnail_url=m.get("thumbnail_url", ""),
                                caption=m.get("caption", ""),
                                is_primary=m.get("is_primary", idx == 0),
                                order=m.get("order", idx)
                            )
                    
                    if created:
                        interaction.added_discoveries.add(discovery)
                    saved_discovery_ids.append(discovery.id)
                    
                # Update Interaction with the normalized response
                normalized_response["discoveries"] = saved_discovery_ids
                interaction.response = normalized_response
                interaction.status = "completed"
                interaction.completed_at = timezone.now()
                interaction.save()
                
        except Exception as e:
            logger.error(f"Failed to persist orchestration result: {e}")
            interaction.status = "failed"
            interaction.error_code = "persistence_failed"
            interaction.response = {"error": "Failed to persist interaction results."}
            interaction.completed_at = timezone.now()
            interaction.save()
