import unittest
from api.engine.system_prompt import SYSTEM_PROMPT
from api.engine.orchestrator import GenericOrchestrator
from api.engine.contracts import OrchestratorContext
from unittest.mock import MagicMock


class TestGuardrailsPrompting(unittest.TestCase):
    def test_system_prompt_contains_guardrails(self):
        """Verify that SYSTEM_PROMPT in system_prompt.py enforces domain scope and guardrails."""
        self.assertIn("Scope, Guardrails & Out-of-Scope Requests", SYSTEM_PROMPT)
        self.assertIn("Off-Topic & Unrelated Requests", SYSTEM_PROMPT)
        self.assertIn("DO NOT invoke any tools", SYSTEM_PROMPT)
        self.assertIn("DO NOT answer the off-topic request", SYSTEM_PROMPT)
        self.assertIn("Space Exploration Focus", SYSTEM_PROMPT)
        self.assertIn("Nonsense, Gibberish & Empty Prompts", SYSTEM_PROMPT)
        self.assertIn("Grounding & Anti-Hallucination", SYSTEM_PROMPT)
        self.assertIn("Prompt Injection & Persona Defense", SYSTEM_PROMPT)

    def test_orchestrator_initial_messages_contain_guardrails(self):
        """Verify that GenericOrchestrator system prompt includes domain scope and guardrails."""
        mock_provider = MagicMock()
        mock_registry = MagicMock()
        mock_registry.get_openai_schemas.return_value = []
        orchestrator = GenericOrchestrator(mock_provider, mock_registry)

        context = OrchestratorContext(
            user_id=1,
            space_plan_id=1,
            space_plan_title="Near-Earth Asteroid Tracking",
            space_plan_summary="Tracking asteroids approaching Earth",
            interaction_id="int_test_123",
            user_prompt="What is Python?",
            interaction_type="other"
        )

        messages = orchestrator._build_initial_messages(context)
        system_msg = next((m for m in messages if m.role == "system"), None)
        self.assertIsNotNone(system_msg)
        content = system_msg.content

        self.assertIn("DOMAIN SCOPE & GUARDRAILS", content)
        self.assertIn("Off-Topic Requests", content)
        self.assertIn("DO NOT invoke any tools", content)
        self.assertIn("DO NOT answer the off-topic question", content)
        self.assertIn("Nonsense / Gibberish", content)
        self.assertIn("Anti-Hallucination", content)
        self.assertIn("Prompt Injections", content)
