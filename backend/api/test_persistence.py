import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from api.models import SpacePlan, Interaction, Discovery, DiscoveryMedia
from api.engine.contracts import OrchestratorResult, ToolResult, DiscoveryData, ResultType
from api.engine.result_normalizer import ResultNormalizer
from api.services.result_persistence import ResultPersistenceService
from django.db import IntegrityError

User = get_user_model()

class TestPersistenceBoundary(TestCase):
    def setUp(self):
        self.user1 = User.objects.create(username="user1")
        self.user2 = User.objects.create(username="user2")
        
        self.plan1 = SpacePlan.objects.create(user=self.user1, title="Plan 1", prompt="Prompt 1")
        self.interaction1 = Interaction.objects.create(
            space_plan=self.plan1,
            user_prompt="Interaction 1",
            interaction_type="other"
        )
        
    def test_normalizer_single_tool(self):
        result = OrchestratorResult(
            success=True,
            tool_results=[
                ToolResult(
                    tool_name="apod",
                    result_type=ResultType.APOD.value,
                    data={"title": "A Star", "explanation": "Test explanation"},
                    metadata={"query": "test"}
                )
            ]
        )
        
        normalized = ResultNormalizer.normalize(result)
        self.assertEqual(normalized["result_type"], "apod")
        self.assertEqual(normalized["content"]["title"], "A Star")
        self.assertEqual(normalized["metadata"]["query"], "test")
        
    def test_normalizer_multiple_tools(self):
        result = OrchestratorResult(
            success=True,
            tool_results=[
                ToolResult(
                    tool_name="apod",
                    result_type=ResultType.APOD.value,
                    data={"title": "A Star", "summary": "APOD summary"}
                ),
                ToolResult(
                    tool_name="neows",
                    result_type=ResultType.NEOWS.value,
                    data={"title": "Asteroid 1", "summary": "NeoWs summary"}
                )
            ],
            llm_content="Synthesized response"
        )
        
        normalized = ResultNormalizer.normalize(result)
        self.assertEqual(normalized["result_type"], "analysis")
        self.assertEqual(len(normalized["content"]["sections"]), 1)
        self.assertEqual(normalized["content"]["sections"][0]["heading"], "Response")
        self.assertEqual(normalized["content"]["sections"][0]["content"], "Synthesized response")
        self.assertEqual(normalized["content"]["title"], "Analysis")
        self.assertEqual(normalized["metadata"]["tool_count"], 2)

    def test_normalizer_multiple_tools_without_synthesis_fallback(self):
        result = OrchestratorResult(
            success=True,
            tool_results=[
                ToolResult(
                    tool_name="apod",
                    result_type=ResultType.APOD.value,
                    data={"title": "A Star", "summary": "APOD summary"}
                ),
                ToolResult(
                    tool_name="neows",
                    result_type=ResultType.NEOWS.value,
                    data={"title": "Asteroid 1", "summary": "NeoWs summary"}
                )
            ]
        )
        normalized = ResultNormalizer.normalize(result)
        self.assertEqual(normalized["result_type"], "analysis")
        self.assertEqual(len(normalized["content"]["sections"]), 2)
        self.assertEqual(normalized["content"]["sections"][0]["heading"], "A Star")
        self.assertEqual(normalized["content"]["sections"][1]["heading"], "Asteroid 1")
        self.assertEqual(normalized["metadata"]["tool_count"], 2)
        
    def test_normalizer_partial_failure(self):
        result = OrchestratorResult(
            success=True,
            tool_results=[
                ToolResult(
                    tool_name="apod",
                    result_type=ResultType.APOD.value,
                    data={"title": "A Star"}
                ),
                ToolResult(
                    tool_name="neows",
                    result_type="error",
                    data={"error": "API failed"}
                )
            ]
        )
        
        normalized = ResultNormalizer.normalize(result)
        self.assertEqual(normalized["result_type"], "apod")
        self.assertIn("tool_failures", normalized["metadata"])
        self.assertEqual(normalized["metadata"]["tool_failures"][0]["tool"], "neows")
        
    def test_persistence_deduplication(self):
        # First save
        disc_data = DiscoveryData(
            source="apod",
            external_id="ext-123",
            title="First APOD",
            summary="Original summary",
            media=[{"media_type": "image", "url": "http://test.com/img.jpg"}]
        )
        
        result1 = OrchestratorResult(
            success=True,
            tool_results=[],
            discoveries=[disc_data]
        )
        
        ResultPersistenceService.persist_result(self.interaction1, result1, self.user1.id)
        
        self.assertEqual(Discovery.objects.count(), 1)
        self.assertEqual(DiscoveryMedia.objects.count(), 1)
        disc = Discovery.objects.first()
        self.assertEqual(disc.title, "First APOD")
        
        # Second save (duplicate external_id)
        disc_data.title = "Second APOD (should not update title)"
        disc_data.summary = "Updated summary"
        
        interaction2 = Interaction.objects.create(space_plan=self.plan1, user_prompt="test", interaction_type="other")
        
        result2 = OrchestratorResult(
            success=True,
            tool_results=[],
            discoveries=[disc_data]
        )
        
        ResultPersistenceService.persist_result(interaction2, result2, self.user1.id)
        
        self.assertEqual(self.interaction1.added_discoveries.count(), 1)
        self.assertEqual(interaction2.added_discoveries.count(), 0)
        
        disc.refresh_from_db()
        self.assertEqual(disc.title, "First APOD") # Identity preserved
        self.assertEqual(disc.summary, "Updated summary") # Summary updated

    def test_added_discoveries_isolation_on_repeat_interactions(self):
        # Turn 1 introduces d1 and d2
        d1 = DiscoveryData(source="apod", external_id="apod_1", title="APOD 1", summary="summary 1")
        d2 = DiscoveryData(source="neows", external_id="neo_2", title="Asteroid 2", summary="summary 2")
        res1 = OrchestratorResult(success=True, discoveries=[d1, d2])
        ResultPersistenceService.persist_result(self.interaction1, res1, self.user1.id)

        self.assertEqual(self.interaction1.added_discoveries.count(), 2)

        # Turn 2 re-references d1 and introduces new d3
        int2 = Interaction.objects.create(space_plan=self.plan1, user_prompt="Turn 2")
        d3 = DiscoveryData(source="donki", external_id="donki_3", title="Flare 3", summary="summary 3")
        res2 = OrchestratorResult(success=True, discoveries=[d1, d3])
        ResultPersistenceService.persist_result(int2, res2, self.user1.id)

        # Only d3 was created in Turn 2, so int2.added_discoveries must have count 1
        self.assertEqual(int2.added_discoveries.count(), 1)
        self.assertEqual(int2.added_discoveries.first().external_id, "donki_3")

        # Turn 3 only updates/references d1 and d2 without introducing any new discoveries
        int3 = Interaction.objects.create(space_plan=self.plan1, user_prompt="Turn 3")
        res3 = OrchestratorResult(success=True, discoveries=[d1, d2])
        ResultPersistenceService.persist_result(int3, res3, self.user1.id)

        # No discoveries were created in Turn 3, so int3.added_discoveries must have count 0
        self.assertEqual(int3.added_discoveries.count(), 0)
        
    def test_persistence_ordering(self):
        d1 = DiscoveryData(source="apod", external_id="1", title="First", summary="")
        d2 = DiscoveryData(source="neows", external_id="2", title="Second", summary="")
        
        result = OrchestratorResult(success=True, discoveries=[d1, d2])
        ResultPersistenceService.persist_result(self.interaction1, result, self.user1.id)
        
        disc1 = Discovery.objects.get(external_id="1")
        disc2 = Discovery.objects.get(external_id="2")
        
        self.assertEqual(disc1.sort_order, 0)
        self.assertEqual(disc2.sort_order, 1)
        
        # Add a third one in a new interaction
        interaction2 = Interaction.objects.create(space_plan=self.plan1, user_prompt="test")
        d3 = DiscoveryData(source="donki", external_id="3", title="Third", summary="")
        result2 = OrchestratorResult(success=True, discoveries=[d3])
        
        ResultPersistenceService.persist_result(interaction2, result2, self.user1.id)
        disc3 = Discovery.objects.get(external_id="3")
        self.assertEqual(disc3.sort_order, 2)
        
    def test_persistence_security(self):
        result = OrchestratorResult(success=True)
        # Try to save user1's interaction with user2's context
        with self.assertRaises(PermissionError):
            ResultPersistenceService.persist_result(self.interaction1, result, self.user2.id)
            
    def test_persistence_null_external_ids(self):
        d1 = DiscoveryData(source="analysis", external_id=None, title="Idea 1", summary="")
        d2 = DiscoveryData(source="analysis", external_id=None, title="Idea 2", summary="")
        
        result = OrchestratorResult(success=True, discoveries=[d1, d2])
        ResultPersistenceService.persist_result(self.interaction1, result, self.user1.id)
        
        self.assertEqual(Discovery.objects.count(), 2)
        
    @patch('api.services.result_persistence.Discovery.objects.create')
    def test_persistence_transaction_rollback(self, mock_create):
        # Simulate a DB failure halfway through
        mock_create.side_effect = Exception("DB crash")
        
        d1 = DiscoveryData(source="apod", external_id="1", title="First", summary="")
        result = OrchestratorResult(success=True, discoveries=[d1])
        
        ResultPersistenceService.persist_result(self.interaction1, result, self.user1.id)
        
        # Interaction should be marked as failed
        self.interaction1.refresh_from_db()
        self.assertEqual(self.interaction1.status, "failed")
        self.assertEqual(self.interaction1.error_code, "persistence_failed")
        # No discoveries should have been created (if create had succeeded on a previous object)
        self.assertEqual(Discovery.objects.count(), 0)

    def test_interaction_response_json_serializable(self):
        result = OrchestratorResult(
            success=True,
            tool_results=[
                ToolResult(tool_name="apod", result_type="apod", data={"info": 123})
            ]
        )
        ResultPersistenceService.persist_result(self.interaction1, result, self.user1.id)
        
        self.interaction1.refresh_from_db()
        # Verify we can dump it (already loaded as dict by Django JSONField)
        json_str = json.dumps(self.interaction1.response)
        self.assertIn("apod", json_str)
