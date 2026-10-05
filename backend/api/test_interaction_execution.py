import json
from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from api.models import SpacePlan, Interaction, Discovery
from api.engine.contracts import (
    LLMResponse, ToolCall, OrchestratorErrorCode, OrchestratorResult
)
from api.engine.providers.openrouter import ProviderError
from api.services.interaction_execution import execute_interaction

User = get_user_model()

from django.urls import reverse

class InteractionExecutionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.other_user = User.objects.create_user(username="otheruser", password="password")
        
        self.space_plan = SpacePlan.objects.create(
            user=self.user,
            title="Mars Plan",
            prompt="Tell me about Mars",
            summary="A plan about Mars."
        )
        
        self.other_plan = SpacePlan.objects.create(
            user=self.other_user,
            title="Venus Plan",
            prompt="Tell me about Venus"
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = reverse('interaction_list_create', args=[self.space_plan.id])

    @patch("api.engine.orchestrator.GenericOrchestrator.execute")
    def test_execute_interaction_success_analysis(self, mock_execute):
        # Mock orchestrator to return a successful result
        mock_execute.return_value = OrchestratorResult(
            success=True,
            llm_content="Mars is a red planet.",
            tool_results=[],
            discoveries=[]
        )
        
        interaction = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="What color is it?",
            interaction_type="enrich",
            status="pending"
        )
        
        execute_interaction(interaction)
        
        interaction.refresh_from_db()
        self.assertEqual(interaction.status, "completed")
        self.assertIsNotNone(interaction.completed_at)
        self.assertEqual(interaction.response["result_type"], "analysis")

    @patch("api.engine.orchestrator.GenericOrchestrator.execute")
    def test_execute_interaction_provider_failure(self, mock_execute):
        mock_execute.return_value = OrchestratorResult(
            success=False,
            error_code=OrchestratorErrorCode.PROVIDER_UNAVAILABLE,
            error_message="Provider down."
        )
        
        interaction = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="Help",
            interaction_type="find_more",
            status="pending"
        )
        
        execute_interaction(interaction)
        
        interaction.refresh_from_db()
        self.assertEqual(interaction.status, "failed")
        self.assertEqual(interaction.error_code, OrchestratorErrorCode.PROVIDER_UNAVAILABLE)
        self.assertEqual(interaction.response["error"], "Provider down.")

    @patch("api.services.result_persistence.ResultPersistenceService.persist_result")
    @patch("api.engine.orchestrator.GenericOrchestrator.execute")
    def test_execute_interaction_persistence_failure(self, mock_execute, mock_persist):
        mock_execute.return_value = OrchestratorResult(success=True)
        
        mock_persist.side_effect = Exception("DB crash")
        
        interaction = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="Help",
            interaction_type="find_more",
            status="pending"
        )
        
        execute_interaction(interaction)
        
        interaction.refresh_from_db()
        self.assertEqual(interaction.status, "failed")
        self.assertEqual(interaction.error_code, "persistence_failed")
        
    @patch("api.engine.orchestrator.GenericOrchestrator.execute")
    def test_execute_interaction_duplicate_prevention(self, mock_execute):
        interaction = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="Help",
            interaction_type="find_more",
            status="processing"
        )
        
        execute_interaction(interaction)
        
        # Orchestrator should not be called because status != pending
        mock_execute.assert_not_called()

    @patch("api.services.interaction_execution.OrchestratorContext")
    def test_execute_interaction_unhandled_exception(self, mock_context):
        # Force an unexpected exception during context building (e.g., simulating DB disconnection)
        mock_context.side_effect = Exception("Surprise DB crash")
        
        interaction = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="Help",
            interaction_type="find_more",
            status="pending"
        )
        
        execute_interaction(interaction)
        
        interaction.refresh_from_db()
        self.assertEqual(interaction.status, "failed")
        self.assertEqual(interaction.error_code, OrchestratorErrorCode.UNEXPECTED_ERROR)
        self.assertEqual(interaction.response["error"], "An internal system error occurred during execution.")
        
    @patch("api.engine.orchestrator.GenericOrchestrator.execute")
    def test_execute_interaction_historical_context(self, mock_execute):
        import datetime
        from django.utils import timezone
        now = timezone.now()

        # Create a past APOD interaction
        past_interaction_1 = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="Show me an APOD",
            interaction_type="find_more",
            status="completed",
            response={
                "result_type": "apod",
                "content": {
                    "title": "A beautiful galaxy",
                    "explanation": "This is an explanation."
                },
                "metadata": {
                    "synthesis": "I found this galaxy for you."
                }
            }
        )
        Interaction.objects.filter(id=past_interaction_1.id).update(created_at=now - datetime.timedelta(minutes=10))

        # Create a past Analysis interaction
        past_interaction_2 = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="Analyze this",
            interaction_type="enrich",
            status="completed",
            response={
                "result_type": "analysis",
                "content": {
                    "title": "Consolidated Analysis",
                    "sections": [
                        {"heading": "Summary", "content": "This is a summary."},
                        {"heading": "Synthesis", "content": "Overall looks good."}
                    ]
                }
            }
        )
        Interaction.objects.filter(id=past_interaction_2.id).update(created_at=now - datetime.timedelta(minutes=5))
        
        # Add target discovery to past_interaction_2 to test lightweight references
        d = Discovery.objects.create(
            space_plan=self.space_plan, source="apod", type="image", title="Past target", summary="Test"
        )
        past_interaction_2.target_discoveries.add(d)

        mock_execute.return_value = OrchestratorResult(success=True)

        current_interaction = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="Compare those",
            interaction_type="compare",
            status="pending"
        )
        
        execute_interaction(current_interaction)
        
        mock_execute.assert_called_once()
        context = mock_execute.call_args[0][0]
        
        self.assertEqual(len(context.previous_interactions), 2)
        
        # Check chronological order (past_interaction_1 then 2)
        hist_1 = context.previous_interactions[0]
        self.assertEqual(hist_1.user_prompt, "Show me an APOD")
        self.assertIn("A beautiful galaxy", hist_1.assistant_response_summary)
        self.assertIn("This is an explanation.", hist_1.assistant_response_summary)
        self.assertIn("I found this galaxy", hist_1.assistant_response_summary)
        
        hist_2 = context.previous_interactions[1]
        self.assertEqual(hist_2.user_prompt, "Analyze this")
        self.assertIn("Consolidated Analysis", hist_2.assistant_response_summary)
        self.assertIn("Summary: This is a summary.", hist_2.assistant_response_summary)
        self.assertEqual(len(hist_2.target_discoveries), 1)
        self.assertEqual(hist_2.target_discoveries[0]["title"], "Past target")
        self.assertEqual(hist_2.target_discoveries[0]["id"], str(d.id))

    @patch("api.engine.orchestrator.GenericOrchestrator.execute")
    def test_execute_interaction_historical_context_truncation(self, mock_execute):
        import datetime
        from django.utils import timezone
        now = timezone.now()

        # Create a past interaction with oversized user prompt and synthesis
        oversized_prompt = "A" * 1000
        oversized_synthesis = "B" * 2000
        
        past_interaction = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt=oversized_prompt,
            interaction_type="find_more",
            status="completed",
            response={
                "result_type": "apod",
                "content": {
                    "title": "Title",
                    "explanation": "Exp"
                },
                "metadata": {
                    "synthesis": oversized_synthesis
                }
            }
        )
        Interaction.objects.filter(id=past_interaction.id).update(created_at=now - datetime.timedelta(minutes=10))

        mock_execute.return_value = OrchestratorResult(success=True)

        current_interaction = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="Hello",
            interaction_type="other",
            status="pending"
        )
        
        execute_interaction(current_interaction)
        
        mock_execute.assert_called_once()
        context = mock_execute.call_args[0][0]
        
        self.assertEqual(len(context.previous_interactions), 1)
        hist = context.previous_interactions[0]
        
        # Verify user prompt truncation (limit 300)
        self.assertEqual(len(hist.user_prompt), 300)
        self.assertTrue(hist.user_prompt.endswith("..."))
        
        # Verify synthesis/condensed truncation (limit 600)
        self.assertEqual(len(hist.assistant_response_summary), 600)
        self.assertTrue(hist.assistant_response_summary.endswith("..."))

    @patch("api.engine.orchestrator.GenericOrchestrator.execute")
    def test_execute_interaction_spaceplan_isolation(self, mock_execute):
        import datetime
        from django.utils import timezone
        now = timezone.now()

        # Create a completed interaction on a DIFFERENT space plan
        other_interaction = Interaction.objects.create(
            space_plan=self.other_plan,
            user_prompt="I am from Venus",
            interaction_type="find_more",
            status="completed",
            response={"result_type": "analysis"}
        )
        Interaction.objects.filter(id=other_interaction.id).update(created_at=now - datetime.timedelta(minutes=10))
        
        # Create a completed interaction on the CURRENT space plan
        my_interaction = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="I am from Mars",
            interaction_type="find_more",
            status="completed",
            response={"result_type": "analysis"}
        )
        Interaction.objects.filter(id=my_interaction.id).update(created_at=now - datetime.timedelta(minutes=5))

        mock_execute.return_value = OrchestratorResult(success=True)

        current_interaction = Interaction.objects.create(
            space_plan=self.space_plan,
            user_prompt="Compare",
            interaction_type="compare",
            status="pending"
        )
        
        execute_interaction(current_interaction)
        
        mock_execute.assert_called_once()
        context = mock_execute.call_args[0][0]
        
        # Verify only the active plan's interaction is included
        self.assertEqual(len(context.previous_interactions), 1)
        self.assertEqual(context.previous_interactions[0].user_prompt, "I am from Mars")

    def test_api_invalid_target_discovery(self):
        # Create a discovery belonging to someone else
        other_discovery = Discovery.objects.create(
            space_plan=self.other_plan,
            source="apod",
            type="image",
            title="Venus Pic",
            summary="Venus"
        )
        
        response = self.client.post(
            self.url,
            {
                "user_prompt": "Tell me about this",
                "interaction_type": "enrich",
                "target_discoveries": [other_discovery.id]
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, 400)
        self.assertIn("target_discoveries", response.data)
        
    @patch("api.engine.providers.openrouter.OpenRouterProvider.generate")
    def test_api_end_to_end_successful(self, mock_generate):
        # End to end via API
        mock_generate.return_value = LLMResponse(
            content="API Test Content",
            finish_reason="stop"
        )
        
        response = self.client.post(
            self.url,
            {
                "user_prompt": "Tell me about API",
                "interaction_type": "enrich",
                "target_discoveries": []
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "completed")
        self.assertEqual(response.data["response"]["result_type"], "analysis")
        
        # Verify in DB
        interaction = Interaction.objects.get(id=response.data["id"])
        self.assertEqual(interaction.status, "completed")
        self.assertIsNotNone(interaction.completed_at)

    @patch("api.engine.providers.openrouter.OpenRouterProvider.generate")
    def test_api_end_to_end_tool_result(self, mock_generate):
        pass

    @patch("api.engine.tool_registry_v2.registry.has")
    @patch("api.engine.tool_registry_v2.registry.get")
    @patch("api.engine.providers.openrouter.OpenRouterProvider.generate")
    def test_tool_result_persisted(self, mock_generate, mock_tool_get, mock_tool_has):
        from api.engine.contracts import ToolResult, DiscoveryData
        
        mock_tool_has.return_value = True
        
        # Mock the tool
        mock_tool = MagicMock()
        mock_tool.name = "get_apod"
        mock_tool.validate_arguments.return_value = {"date": "2023-01-01"}
        mock_tool.execute.return_value = ToolResult(
            tool_name="get_apod",
            result_type="apod",
            data={"title": "Mock APOD", "date": "2023-01-01"},
            discoveries=[
                DiscoveryData(
                    source="apod",
                    external_id="2023-01-01",
                    title="Mock APOD",
                    summary="Test summary",
                    date="2023-01-01"
                )
            ]
        )
        mock_tool_get.return_value = mock_tool
        
        # The LLM asks for the tool on round 1, then stops on round 2
        mock_generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall("get_apod", {"date": "2023-01-01"})],
                finish_reason="tool_calls"
            ),
            LLMResponse(
                content="Here is the picture.",
                finish_reason="stop"
            )
        ]
        
        response = self.client.post(
            self.url,
            {
                "user_prompt": "Show me APOD",
                "interaction_type": "find_more"
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "completed")
        self.assertEqual(response.data["response"]["result_type"], "apod")
        self.assertEqual(response.data["response"]["content"]["title"], "Mock APOD")
        
        # Verify discovery was added
        interaction = Interaction.objects.get(id=response.data["id"])
        added = interaction.added_discoveries.all()
        self.assertEqual(len(added), 1)
        self.assertEqual(added[0].title, "Mock APOD")
        
        # Verify it is also linked in the response payload
        self.assertIn(added[0].id, response.data["response"]["discoveries"])
