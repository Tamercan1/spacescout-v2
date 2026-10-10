import json
import unittest
from unittest.mock import MagicMock, patch

from api.engine.contracts import (
    OrchestratorContext,
    OrchestratorErrorCode,
    LLMMessage,
    LLMResponse,
    ToolCall,
    ToolResult,
    ToolExecutionError,
    ResultType,
    BaseTool,
    ToolExecutionContext,
    PreviousInteractionContext
)
from api.engine.tool_registry_v2 import ToolRegistry
from api.engine.orchestrator import GenericOrchestrator
from api.engine.providers.openrouter import ProviderError

class FakeTool(BaseTool):
    def __init__(self, name="fake_tool", schema=None):
        self._name = name
        self._schema = schema or {
            "name": name,
            "description": "Fake tool for testing",
            "parameters": {
                "type": "object",
                "properties": {
                    "arg1": {"type": "string"}
                },
                "required": ["arg1"]
            }
        }
        self.execute_mock = MagicMock()
        
    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return "Fake tool for testing"
        
    @property
    def parameters(self) -> list:
        return []
        
    @property
    def result_type(self) -> str:
        return ResultType.ANALYSIS.value
        
    def get_openai_schema(self) -> dict:
        return self._schema
        
    def validate_arguments(self, arguments: dict) -> dict:
        if "arg1" not in arguments:
            raise ValueError("Missing required argument: arg1")
        return arguments
        
    def execute(self, context: ToolExecutionContext, **kwargs) -> ToolResult:
        return self.execute_mock(context, **kwargs)

class TestOrchestrator(unittest.TestCase):
    def setUp(self):
        self.provider = MagicMock()
        self.registry = ToolRegistry()
        self.orchestrator = GenericOrchestrator(self.provider, self.registry)
        self.context = OrchestratorContext(
            user_id=1,
            space_plan_id=10,
            space_plan_title="Test Plan",
            space_plan_summary="Test Summary",
            interaction_id="uuid",
            interaction_type="default",
            user_prompt="Hello"
        )

    def test_basic_final_response(self):
        # LLM returns a plain text response without tools
        self.provider.generate.return_value = LLMResponse(content="Hi there!")
        
        result = self.orchestrator.execute(self.context)
        
        self.assertTrue(result.success)
        self.assertEqual(result.llm_content, "Hi there!")
        self.assertEqual(len(result.tool_results), 0)
        self.provider.generate.assert_called_once()

    def test_one_tool_call(self):
        # LLM requests a tool, tool executes, LLM produces final response
        fake_tool = FakeTool()
        fake_tool.execute_mock.return_value = ToolResult(
            tool_name="fake_tool",
            result_type=ResultType.APOD.value,
            data={"title": "Fake APOD", "explanation": "Test"}
        )
        self.registry.register(fake_tool)
        
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={"arg1": "val1"})]
            ),
            LLMResponse(content="Here is your APOD.")
        ]
        
        result = self.orchestrator.execute(self.context)
        
        self.assertTrue(result.success)
        self.assertEqual(self.provider.generate.call_count, 2)
        fake_tool.execute_mock.assert_called_once()
        self.assertEqual(len(result.tool_results), 1)
        self.assertEqual(result.tool_results[0].result_type, "apod")
        self.assertEqual(result.llm_content, "Here is your APOD.")
        
        # Verify the tool result was passed to LLM correctly
        second_call_messages = self.provider.generate.call_args_list[1][1]["messages"]
        tool_msg = [m for m in second_call_messages if m.role == "tool"][0]
        self.assertIn("Fake APOD", tool_msg.content)

    def test_multiple_tool_rounds(self):
        fake_tool = FakeTool()
        fake_tool.execute_mock.return_value = ToolResult(
            tool_name="fake_tool",
            result_type=ResultType.ANALYSIS.value,
            data={"info": "done"}
        )
        self.registry.register(fake_tool)
        
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={"arg1": "val1"})]
            ),
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={"arg1": "val2"})]
            ),
            LLMResponse(content="Final summary.")
        ]
        
        result = self.orchestrator.execute(self.context)
        
        self.assertTrue(result.success)
        self.assertEqual(self.provider.generate.call_count, 3)
        self.assertEqual(fake_tool.execute_mock.call_count, 2)
        self.assertEqual(len(result.tool_results), 2)
        self.assertEqual(result.llm_content, "Final summary.")
        
    def test_case_b_apod_plus_neows(self):
        # Case B - APOD + NeoWs in sequence
        apod_tool = FakeTool(name="apod")
        apod_tool.execute_mock.return_value = ToolResult(
            tool_name="apod",
            result_type="apod",
            data={"title": "APOD Title"}
        )
        neows_tool = FakeTool(name="neows")
        neows_tool.execute_mock.return_value = ToolResult(
            tool_name="neows",
            result_type="neows",
            data={"title": "NeoWs Title"}
        )
        self.registry.register(apod_tool)
        self.registry.register(neows_tool)
        
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="apod", arguments={"arg1": "date"})]
            ),
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="neows", arguments={"arg1": "date"})]
            ),
            LLMResponse(content="Here is the final comparison.")
        ]
        
        result = self.orchestrator.execute(self.context)
        
        self.assertTrue(result.success)
        self.assertEqual(self.provider.generate.call_count, 3)
        apod_tool.execute_mock.assert_called_once()
        neows_tool.execute_mock.assert_called_once()
        
        self.assertEqual(len(result.tool_results), 2)
        self.assertEqual(result.tool_results[0].result_type, "apod")
        self.assertEqual(result.tool_results[1].result_type, "neows")
        self.assertEqual(result.llm_content, "Here is the final comparison.")


    def test_multiple_tool_calls_in_one_response(self):
        fake_tool = FakeTool()
        fake_tool.execute_mock.return_value = ToolResult(
            tool_name="fake_tool",
            result_type=ResultType.ANALYSIS.value,
            data={"info": "done"}
        )
        self.registry.register(fake_tool)
        
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[
                    ToolCall(tool_name="fake_tool", arguments={"arg1": "val1"}),
                    ToolCall(tool_name="fake_tool", arguments={"arg1": "val2"})
                ]
            ),
            LLMResponse(content="Both done.")
        ]
        
        result = self.orchestrator.execute(self.context)
        
        self.assertTrue(result.success)
        self.assertEqual(self.provider.generate.call_count, 2)
        self.assertEqual(fake_tool.execute_mock.call_count, 2)
        
        # Case C - Multiple tools in one turn
        self.assertEqual(len(result.tool_results), 2)
        self.assertEqual(result.llm_content, "Both done.")

    def test_unknown_tool(self):
        # Requesting a tool not in registry
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="magic_tool", arguments={})]
            ),
            LLMResponse(content="Oops, tool missing.")
        ]
        
        result = self.orchestrator.execute(self.context)
        
        self.assertTrue(result.success)
        # Should feed the error back to the LLM and eventually succeed
        # Let's verify the message passed in the second generate call contains the error
        second_call_messages = self.provider.generate.call_args_list[1][1]["messages"]
        tool_msg = [m for m in second_call_messages if m.role == "tool"][0]
        self.assertIn("Unknown tool requested: magic_tool", tool_msg.content)

    def test_invalid_arguments(self):
        fake_tool = FakeTool()
        self.registry.register(fake_tool)
        
        # Missing 'arg1'
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={})]
            ),
            LLMResponse(content="Oops, missing args.")
        ]
        
        result = self.orchestrator.execute(self.context)
        
        fake_tool.execute_mock.assert_not_called()
        self.assertTrue(result.success)
        second_call_messages = self.provider.generate.call_args_list[1][1]["messages"]
        tool_msg = [m for m in second_call_messages if m.role == "tool"][0]
        self.assertIn("Missing required argument", tool_msg.content)

    def test_tool_execution_failure(self):
        fake_tool = FakeTool()
        # Tool raises execution error
        fake_tool.execute_mock.side_effect = ToolExecutionError("External service down")
        self.registry.register(fake_tool)
        
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={"arg1": "test"})]
            ),
            LLMResponse(content="Sorry, the service is down.")
        ]
        
        result = self.orchestrator.execute(self.context)
        
        self.assertTrue(result.success)
        self.assertEqual(len(result.tool_results), 1)
        self.assertEqual(result.tool_results[0].result_type, "error")
        second_call_messages = self.provider.generate.call_args_list[1][1]["messages"]
        tool_msg = [m for m in second_call_messages if m.role == "tool"][0]
        self.assertIn("External service down", tool_msg.content)

    def test_provider_error(self):
        self.provider.generate.side_effect = ProviderError("Too many requests", OrchestratorErrorCode.PROVIDER_RATE_LIMITED)
        
        result = self.orchestrator.execute(self.context)
        
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, OrchestratorErrorCode.PROVIDER_RATE_LIMITED)
        
    def test_maximum_rounds(self):
        fake_tool = FakeTool()
        fake_tool.execute_mock.return_value = ToolResult(
            tool_name="fake_tool",
            result_type=ResultType.ANALYSIS.value,
            data={}
        )
        self.registry.register(fake_tool)
        
        # LLM keeps returning tool calls forever
        def mock_generate(*args, **kwargs):
            return LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={"arg1": "loop"})]
            )
            
        self.provider.generate.side_effect = mock_generate
        
        result = self.orchestrator.execute(self.context)
        
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, OrchestratorErrorCode.MAX_TOOL_ROUNDS_EXCEEDED)
        self.assertEqual(self.provider.generate.call_count, 8)

    def test_tool_registry_schemas_wrapper(self):
        fake_tool = FakeTool()
        self.registry.register(fake_tool)
        schemas = self.registry.get_openai_schemas()
        
        self.assertEqual(len(schemas), 1)
        self.assertIn("type", schemas[0])
        self.assertEqual(schemas[0]["type"], "function")
        self.assertIn("function", schemas[0])
        self.assertEqual(schemas[0]["function"]["name"], "fake_tool")

    def test_repeated_identical_failed_tool_calls_blocked(self):
        fake_tool = FakeTool()
        fake_tool.execute_mock.return_value = ToolResult(
            tool_name="fake_tool",
            result_type="error",
            data={"error": "Network Error: Could not reach the NASA API."},
            metadata={"success": False}
        )
        self.registry.register(fake_tool)

        # LLM attempts to call the exact same failing tool with identical arguments twice
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={"arg1": "same_target"})]
            ),
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={"arg1": "same_target"})]
            ),
            LLMResponse(content="I am unable to retrieve the requested data.")
        ]

        result = self.orchestrator.execute(self.context)

        self.assertTrue(result.success)
        # Verify the underlying execute method was ONLY called once, not twice
        self.assertEqual(fake_tool.execute_mock.call_count, 1)

        # Verify the second tool message informed the model that identical retries are blocked
        third_call_messages = self.provider.generate.call_args_list[2][1]["messages"]
        tool_messages = [m for m in third_call_messages if m.role == "tool"]
        self.assertEqual(len(tool_messages), 2)
        self.assertIn("already failed with these arguments", tool_messages[1].content)

    def test_failed_tool_preserves_explicit_partial_failures_in_normalizer(self):
        from api.engine.result_normalizer import ResultNormalizer
        fake_tool = FakeTool()
        fake_tool.execute_mock.return_value = ToolResult(
            tool_name="fake_tool",
            result_type="error",
            data={"error": "Connection timed out"},
            metadata={"success": False}
        )
        self.registry.register(fake_tool)

        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={"arg1": "flares"})]
            ),
            LLMResponse(content="Service is down.")
        ]

        result = self.orchestrator.execute(self.context)

        # Check that result has 0 discoveries and preserved error
        self.assertEqual(len(result.discoveries), 0)
        self.assertEqual(len(result.tool_results), 1)
        self.assertEqual(result.tool_results[0].result_type, "error")

        normalized = ResultNormalizer.normalize(result)
        self.assertEqual(normalized["result_type"], "analysis")
        self.assertEqual(len(normalized["discoveries"]), 0)
        self.assertIn("tool_failures", normalized["metadata"])
        self.assertEqual(normalized["metadata"]["tool_failures"][0]["tool"], "fake_tool")
        self.assertEqual(normalized["metadata"]["tool_failures"][0]["error"], "Connection timed out")

    def test_post_tool_llm_enrichment_populates_why_interesting(self):
        from api.engine.contracts import DiscoveryData
        fake_tool = FakeTool()
        disc = DiscoveryData(
            source="fake_tool",
            external_id="disc_1",
            title="Discovery One",
            summary="Discovered item",
            why_interesting=""
        )
        fake_tool.execute_mock.return_value = ToolResult(
            tool_name="fake_tool",
            result_type="custom",
            data={"status": "ok"},
            discoveries=[disc],
            metadata={"success": True}
        )
        self.registry.register(fake_tool)

        # First call: tool call
        # Second call: synthesis response
        # Third call: enrichment pass
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={"arg1": "value"})]
            ),
            LLMResponse(content="Tool execution finished."),
            LLMResponse(content='{"disc_1": "A rare astronomical alignment that reveals unprecedented stellar activity."}')
        ]

        result = self.orchestrator.execute(self.context)
        self.assertTrue(result.success)
        self.assertEqual(len(result.discoveries), 1)
        self.assertEqual(
            result.discoveries[0].why_interesting,
            "A rare astronomical alignment that reveals unprecedented stellar activity."
        )
        self.assertEqual(self.provider.generate.call_count, 3)

    def test_post_tool_llm_enrichment_failure_strict_policy_leaves_blank(self):
        from api.engine.contracts import DiscoveryData
        fake_tool = FakeTool()
        disc = DiscoveryData(
            source="fake_tool",
            external_id="disc_2",
            title="Discovery Two",
            summary="Discovered item",
            why_interesting=""
        )
        fake_tool.execute_mock.return_value = ToolResult(
            tool_name="fake_tool",
            result_type="custom",
            data={"status": "ok"},
            discoveries=[disc],
            metadata={"success": True}
        )
        self.registry.register(fake_tool)

        # First call: tool call
        # Second call: synthesis response
        # Third call: enrichment pass returns malformed response
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="fake_tool", arguments={"arg1": "value"})]
            ),
            LLMResponse(content="Tool execution finished."),
            LLMResponse(content="invalid non-json output")
        ]

        result = self.orchestrator.execute(self.context)
        self.assertTrue(result.success)
        self.assertEqual(len(result.discoveries), 1)
        # Strict LLM-only policy: remains empty string if LLM fails
        self.assertEqual(result.discoveries[0].why_interesting, "")

    def test_multi_turn_history_message_building_and_current_prompt_exact_once(self):
        past1 = PreviousInteractionContext(
            interaction_id="past-1",
            user_prompt="Show me Mars images",
            assistant_response_summary="Found 3 images of Mars.",
            target_discoveries=[{"id": "1", "title": "Mars Rover"}],
            added_discoveries=[{"id": "2", "title": "Perseverance"}]
        )
        past2 = PreviousInteractionContext(
            interaction_id="past-2",
            user_prompt="Tell me about Perseverance",
            assistant_response_summary="Perseverance landed in Jezero Crater.",
            target_discoveries=[{"id": "2", "title": "Perseverance"}],
            added_discoveries=[]
        )
        ctx = OrchestratorContext(
            user_id=1,
            space_plan_id=10,
            space_plan_title="Mars Exploration",
            space_plan_summary="Exploring Mars missions",
            interaction_id="current-int",
            interaction_type="find_more",
            user_prompt="Show me more images of Jezero Crater",
            previous_interactions=[past1, past2]
        )

        messages = self.orchestrator._build_initial_messages(ctx)

        # 1. System prompt is first
        self.assertEqual(messages[0].role, "system")

        # 2. History turns strictly alternate user -> assistant
        user_messages = [m for m in messages if m.role == "user"]
        assistant_messages = [m for m in messages if m.role == "assistant"]

        # Exactly 3 user messages: 2 from history + 1 current prompt
        self.assertEqual(len(user_messages), 3)
        self.assertEqual(user_messages[0].content, "Show me Mars images")
        self.assertEqual(user_messages[1].content, "Tell me about Perseverance")
        self.assertEqual(user_messages[2].content, "Show me more images of Jezero Crater")

        # Exactly 2 assistant messages in history
        self.assertEqual(len(assistant_messages), 2)
        self.assertIn("Found 3 images of Mars.", assistant_messages[0].content)
        self.assertIn("[Targeted context: Mars Rover (ID: 1)]", assistant_messages[0].content)
        self.assertIn("Perseverance landed in Jezero Crater.", assistant_messages[1].content)

        # 3. Final message is strictly the current user prompt, exactly once
        self.assertEqual(messages[-1].role, "user")
        self.assertEqual(messages[-1].content, ctx.user_prompt)

        # Verify current prompt appears exactly once across the whole payload
        current_occurrences = [m for m in messages if m.content == ctx.user_prompt]
        self.assertEqual(len(current_occurrences), 1)

    def test_multi_turn_tool_selection_flow(self):
        past = PreviousInteractionContext(
            interaction_id="past-1",
            user_prompt="Search NASA images for Bennu",
            assistant_response_summary="Found OSIRIS-REx asteroid Bennu assets.",
            target_discoveries=[],
            added_discoveries=[]
        )
        ctx = OrchestratorContext(
            user_id=1,
            space_plan_id=10,
            space_plan_title="Asteroid Bennu",
            space_plan_summary="Mission Bennu",
            interaction_id="int-2",
            interaction_type="find_more",
            user_prompt="Give me page 2 of those images",
            previous_interactions=[past]
        )

        fake_tool = FakeTool(name="nasa_images")
        fake_tool.execute_mock.return_value = ToolResult(
            tool_name="nasa_images",
            result_type="nasa_images",
            data={"title": "Page 2 of Bennu", "items": []},
            discoveries=[]
        )
        self.registry.register(fake_tool)

        # First LLM call requests nasa_images with page 2
        # Second LLM call synthesizes the answer
        self.provider.generate.side_effect = [
            LLMResponse(
                content=None,
                tool_calls=[ToolCall(tool_name="nasa_images", arguments={"arg1": "page_2"})]
            ),
            LLMResponse(content="Here are the page 2 results for Bennu.")
        ]

        result = self.orchestrator.execute(ctx)
        self.assertTrue(result.success)
        self.assertEqual(result.llm_content, "Here are the page 2 results for Bennu.")
        fake_tool.execute_mock.assert_called_once()

