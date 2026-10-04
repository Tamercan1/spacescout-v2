"""
SpaceScout V2 — AI Orchestration Contracts

This module defines the abstract interfaces and data contracts for
the AI orchestration pipeline. It establishes the boundaries between:

    Interaction
        ↓
    Orchestrator
        ↓
    LLM Provider  →  Tool Selection  →  NASA Tool  →  Normalized Result
        ↓
    Persistence
        ↓
    Interaction.response

These are contracts only. Implementation of actual providers, tools,
and orchestration logic belongs in later phases.

Design principles:
    - Provider-independent: The orchestrator does not know about OpenRouter,
      NASA HTTP details, or React components.
    - Tool-extensible: New NASA tools register themselves without modifying
      the orchestrator.
    - Security-first: Credentials never leak into responses, logs, or prompts.
    - Normalized results: Every tool produces a common ToolResult that the
      orchestrator can persist without understanding tool internals.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# ============================================================
# ERROR CONTRACT
# ============================================================

class OrchestratorErrorCode(str, Enum):
    """
    Provider-independent error categories.

    These map to Interaction.error_code values. The frontend should
    be able to render a useful message from any of these without
    understanding provider internals.

    NEVER expose raw provider responses, stack traces, request URLs,
    or credential values through these codes or their messages.
    """
    MISSING_CREDENTIAL = "missing_credential"
    INVALID_CREDENTIAL = "invalid_credential"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    PROVIDER_RATE_LIMITED = "provider_rate_limited"
    TOOL_NOT_FOUND = "tool_not_found"
    TOOL_EXECUTION_FAILED = "tool_execution_failed"
    INVALID_TOOL_ARGUMENTS = "invalid_tool_arguments"
    MODEL_ERROR = "model_error"
    CONTEXT_TOO_LARGE = "context_too_large"
    MAX_TOOL_ROUNDS_EXCEEDED = "max_tool_rounds_exceeded"
    UNEXPECTED_ERROR = "unexpected_error"


# ============================================================
# RESULT TYPE CONTRACT
# ============================================================

class ResultType(str, Enum):
    """
    Identifies the kind of result an interaction produced.

    The frontend uses this value to route to the correct result card.
    Each value corresponds to a specific card renderer on the frontend.

    New result types should be added here when new NASA tools or
    analysis capabilities are introduced.
    """
    APOD = "apod"
    NEOWS = "neows"
    DONKI = "donki"
    ANALYSIS = "analysis"


# ============================================================
# TOOL CALL CONTRACT  (provider-independent)
# ============================================================

@dataclass(frozen=True)
class ToolCall:
    """
    A provider-independent representation of a model-requested tool call.

    The orchestrator translates provider-specific tool-call formats
    (e.g. OpenAI function_call) into this structure before validation
    and execution.

    Attributes:
        tool_name:  Must match a registered tool name in the ToolRegistry.
        arguments:  Must conform to the tool's declared input_schema.
                    Model-generated arguments are NEVER trusted blindly.
    """
    tool_name: str
    arguments: dict[str, Any]


# ============================================================
# TOOL RESULT CONTRACT
# ============================================================

@dataclass
class DiscoveryData:
    """
    Normalized representation of a single discovery produced by a tool.

    This is the internal transfer format between a tool and the orchestrator.
    It contains enough information for the orchestrator to create a
    Discovery model record without understanding the tool's internals.

    Attributes:
        source:          The data source identifier (e.g. "apod", "neows", "donki").
        external_id:     Provider-specific unique identifier for deduplication.
                         Examples: NeoWs object ID, DONKI event ID, APOD date.
        title:           Human-readable title for the discovery.
        summary:         Brief description/explanation.
        why_interesting: AI-generated explanation of why this is notable.
        date:            Date associated with the discovery (YYYY-MM-DD or None).
        source_url:      URL pointing to the original data source.
        facts:           Structured key-value facts (human-readable keys/values).
        details:         Additional structured data that doesn't fit into facts.
        tags:            Categorization tags.
        media:           Optional list of media attachments.
    """
    source: str
    external_id: str | None
    title: str
    summary: str
    why_interesting: str = ""
    date: str | None = None
    source_url: str = ""
    facts: dict[str, Any] = field(default_factory=dict)
    details: dict[str, Any] = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    media: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ToolResult:
    """
    The normalized result returned by any tool after execution.

    This is what the orchestrator receives from a tool. It must be
    provider-independent and contain no React/frontend-specific fields.

    Attributes:
        tool_name:    The tool that produced this result.
        result_type:  One of ResultType values. Determines which frontend
                      card renders this result.
        data:         Arbitrary structured content for the result card.
                      The schema depends on result_type.
        discoveries:  Zero or more normalized discoveries to persist.
                      A tool like APOD produces discoveries; an analysis
                      tool may produce none.
        metadata:     Additional context (e.g. query parameters used,
                      result count, API response metadata). Never contains
                      credentials or raw provider responses.
    """
    tool_name: str
    result_type: str  # Should be a ResultType value
    data: dict[str, Any] = field(default_factory=dict)
    discoveries: list[DiscoveryData] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


# ============================================================
# INTERACTION RESPONSE CONTRACT
# ============================================================
#
# This defines the structure stored in Interaction.response (JSONField).
# The frontend reads this to render the appropriate result card.
#
# Schema:
#
#   {
#       "result_type": "apod" | "neows" | "donki" | "analysis",
#       "content": { ... },          # result-type-specific content
#       "discoveries": [ ... ],      # IDs of discoveries created/referenced
#       "metadata": { ... }          # optional context
#   }
#
# Content schemas by result_type:
#
#   "apod":
#       {
#           "title": str,
#           "date": str,
#           "explanation": str,
#           "media_url": str | null,
#           "media_type": str | null
#       }
#
#   "neows":
#       {
#           "title": str,
#           "summary": str,
#           "object_count": int,
#           "date_range": { "start": str, "end": str }
#       }
#
#   "donki":
#       {
#           "title": str,
#           "summary": str,
#           "event_count": int,
#           "date_range": { "start": str, "end": str }
#       }
#
#   "analysis":
#       {
#           "title": str,
#           "summary": str,
#           "sections": [
#               { "heading": str, "content": str }
#           ]
#       }
#
# NEVER store raw OpenRouter responses, raw NASA API responses,
# credentials, or frontend-specific fields (component names, CSS
# classes) in this structure.


# ============================================================
# TOOL DEFINITION CONTRACT
# ============================================================

@dataclass
class ToolParameter:
    """
    Describes a single parameter accepted by a tool.

    Attributes:
        name:        Parameter name.
        description: Human-readable description (also used in LLM tool schemas).
        type:        JSON Schema type (e.g. "string", "integer").
        required:    Whether this parameter is required.
        enum:        Optional list of allowed values.
    """
    name: str
    description: str
    type: str = "string"
    required: bool = False
    enum: list[str] | None = None


class BaseTool(abc.ABC):
    """
    Abstract base class for all NASA tools.

    Every tool must declare its identity, describe its capabilities
    for the LLM, define its input schema, and implement execution.

    A tool MUST NOT:
        - Know about React components or frontend rendering
        - Access credentials directly (credentials are injected)
        - Make HTTP calls to arbitrary URLs
        - Return raw provider/API responses without normalization

    A tool MUST:
        - Validate its arguments before execution
        - Return a ToolResult with normalized data
        - Handle its own API errors gracefully
        - Use only its own declared external API endpoints

    Example registration (future Phase 5.2+):

        class APODTool(BaseTool):
            name = "get_apod"
            description = "Get NASA Astronomy Picture of the Day"
            result_type = ResultType.APOD
            parameters = [
                ToolParameter(name="date", description="...", required=False),
            ]

            def execute(self, arguments, context):
                ...
                return ToolResult(...)
    """

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Unique tool identifier. Must match tool_registry key."""
        ...

    @property
    @abc.abstractmethod
    def description(self) -> str:
        """Human-readable description for the LLM tool schema."""
        ...

    @property
    @abc.abstractmethod
    def parameters(self) -> list[ToolParameter]:
        """Declared input parameters."""
        ...

    @property
    @abc.abstractmethod
    def result_type(self) -> str:
        """The ResultType this tool produces."""
        ...

    @abc.abstractmethod
    def execute(
        self,
        arguments: dict[str, Any],
        context: "ToolExecutionContext",
    ) -> ToolResult:
        """
        Execute the tool with validated arguments.

        Args:
            arguments:  Validated arguments conforming to self.parameters.
            context:    Execution context including credentials and plan info.

        Returns:
            A ToolResult with normalized data and optional discoveries.

        Raises:
            ToolExecutionError: On expected failures (API errors, bad data).
        """
        ...

    def get_openai_schema(self) -> dict[str, Any]:
        """
        Generate an OpenAI-compatible function tool schema.

        This is used by the LLM provider to understand what tools
        are available. The format is provider-independent (OpenAI
        function calling is the de facto standard).
        """
        properties = {}
        required = []
        for param in self.parameters:
            prop: dict[str, Any] = {
                "type": param.type,
                "description": param.description,
            }
            if param.enum:
                prop["enum"] = param.enum
            properties[param.name] = prop
            if param.required:
                required.append(param.name)

        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
            },
        }

    def validate_arguments(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """
        Validate that arguments conform to the declared parameter schema.

        Returns validated/cleaned arguments dict.
        Raises ValueError with a safe message on invalid input.

        This is a baseline implementation. Tools may override for
        additional validation (e.g. date range limits).
        """
        validated = {}
        param_map = {p.name: p for p in self.parameters}

        # Check for unknown arguments (do not trust model-generated args blindly)
        unknown = set(arguments.keys()) - set(param_map.keys())
        if unknown:
            raise ValueError(f"Unknown arguments: {', '.join(sorted(unknown))}")

        # Check required parameters
        for param in self.parameters:
            if param.required and param.name not in arguments:
                raise ValueError(f"Missing required argument: {param.name}")
            if param.name in arguments:
                value = arguments[param.name]
                if param.enum and value not in param.enum:
                    raise ValueError(
                        f"Invalid value for {param.name}: must be one of {param.enum}"
                    )
                validated[param.name] = value

        return validated


class ToolExecutionError(Exception):
    """
    Raised when a tool encounters an expected failure during execution.

    The error_code should be an OrchestratorErrorCode value.
    The message should be safe to store in Interaction.error_code
    (no credentials, no raw URLs, no stack traces).
    """

    def __init__(self, message: str, error_code: str = OrchestratorErrorCode.TOOL_EXECUTION_FAILED):
        super().__init__(message)
        self.error_code = error_code


# ============================================================
# TOOL EXECUTION CONTEXT
# ============================================================

@dataclass
class ToolExecutionContext:
    """
    Context provided to a tool during execution.

    This gives the tool access to what it needs without exposing
    the full database or orchestrator internals.

    Attributes:
        nasa_api_key:      Resolved NASA API key (user or application default).
                           NEVER stored in results, logs, or responses.
        space_plan_id:     The SpacePlan this execution belongs to.
        user_id:           The authenticated user's ID.
    """
    nasa_api_key: str | None = None
    space_plan_id: int | None = None
    user_id: int | None = None


# ============================================================
# LLM PROVIDER CONTRACT
# ============================================================

@dataclass
class LLMMessage:
    """A single message in the LLM conversation."""
    role: str  # "system", "user", "assistant", "tool"
    content: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None


@dataclass
class LLMResponse:
    """
    A provider-independent LLM response.

    The orchestrator works with this structure regardless of which
    provider (OpenRouter, etc.) produced the response.

    Attributes:
        content:       Text content of the response (may be None if tool_calls).
        tool_calls:    Provider-independent tool call requests.
        finish_reason: Why the model stopped ("stop", "tool_calls", etc.).
        model:         The actual model used (for logging/debugging).
        usage:         Token usage statistics (optional).
    """
    content: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = "stop"
    model: str = ""
    usage: dict[str, int] = field(default_factory=dict)


class BaseLLMProvider(abc.ABC):
    """
    Abstract interface for LLM providers.

    The orchestrator depends on this interface, not on any specific
    provider implementation. This allows swapping providers (e.g.
    OpenRouter → direct Anthropic) without modifying orchestration logic.

    A provider implementation MUST:
        - Translate the provider-independent message format to its own API format.
        - Translate provider-specific responses back to LLMResponse.
        - Handle provider-specific errors and translate them to OrchestratorErrorCodes.
        - NEVER expose API keys in responses or logs.

    Example (future Phase 5.2):

        class OpenRouterProvider(BaseLLMProvider):
            def generate(self, messages, tools, ...):
                # Translate to OpenRouter API format
                # Make HTTP call
                # Translate response to LLMResponse
                ...
    """

    @abc.abstractmethod
    def generate(
        self,
        messages: list[LLMMessage],
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
        tool_choice: str | None = None,
        model: str | None = None,
    ) -> LLMResponse:
        """
        Send a completion request to the LLM provider.

        Args:
            messages:        Conversation history in provider-independent format.
            tools:           OpenAI-compatible tool schemas (optional).
            response_format: Structured output format (optional).
            tool_choice:     Tool selection constraint ("auto", "none", or specific).
            model:           Model identifier override (optional; uses default if None).

        Returns:
            A provider-independent LLMResponse.

        Raises:
            OrchestratorError with appropriate error_code on failure.
        """
        ...


# ============================================================
# ORCHESTRATOR CONTEXT
# ============================================================

@dataclass
class OrchestratorContext:
    """
    The full context available to the orchestrator for a single
    interaction execution.

    This defines what information the orchestrator has access to
    when processing an interaction. It should contain enough context
    to answer follow-up questions (e.g. "tell me more about the
    second discovery") without requiring the frontend to resolve
    references.

    Attributes:
        user_id:              Authenticated user's ID.
        space_plan_id:        The SpacePlan this interaction belongs to.
        space_plan_title:     Current exploration title (for context).
        space_plan_summary:   Current exploration summary.
        interaction_id:       The Interaction being processed.
        user_prompt:          The user's natural-language request.
        interaction_type:     The type of follow-up interaction.
        target_discoveries:   Serialized target discoveries (referenced by user).
        existing_discoveries: Summary of existing discoveries in the plan.
                              This is NOT the entire discovery data — it's a
                              curated summary to avoid sending excessive data
                              to the LLM while still enabling follow-up context.
        preferred_model:      User's preferred LLM model (from UserProfile).
        openrouter_api_key:   Resolved OpenRouter credential.
                              NEVER stored in results, logs, or responses.
        nasa_api_key:         Resolved NASA credential.
                              NEVER stored in results, logs, or responses.
    """
    user_id: int
    space_plan_id: int
    space_plan_title: str
    space_plan_summary: str
    interaction_id: str
    user_prompt: str
    interaction_type: str
    target_discoveries: list[dict[str, Any]] = field(default_factory=list)
    existing_discoveries: list[dict[str, Any]] = field(default_factory=list)
    preferred_model: str = ""
    openrouter_api_key: str | None = None
    nasa_api_key: str | None = None


# ============================================================
# ORCHESTRATOR CONTRACT
# ============================================================

@dataclass
class OrchestratorResult:
    """
    The final result of orchestrator execution.

    This is what the orchestrator returns to the view/API layer.
    The view layer uses this to update the Interaction record.

    Attributes:
        success:      Whether execution completed successfully.
        response:     The normalized response to store in Interaction.response.
                      Must conform to the Interaction Response Contract above.
        error_code:   An OrchestratorErrorCode value if success is False.
        error_message: A safe, user-facing error message.
        discoveries:  Normalized discovery data to persist as Discovery records.
    """
    success: bool
    response: dict[str, Any] = field(default_factory=dict)
    error_code: str = ""
    error_message: str = ""
    discoveries: list[DiscoveryData] = field(default_factory=list)


class BaseOrchestrator(abc.ABC):
    """
    Abstract interface for the AI orchestrator.

    The orchestrator coordinates the full execution pipeline:

        1. Receive context (OrchestratorContext)
        2. Build LLM messages with appropriate system prompt
        3. Call LLM provider
        4. Parse tool-call requests from LLM response
        5. Validate tool calls (tool exists, arguments valid, authorized)
        6. Execute tools via registry
        7. Feed tool results back to LLM (if multi-turn)
        8. Normalize final result
        9. Return OrchestratorResult

    The orchestrator MUST NOT:
        - Contain provider-specific HTTP code
        - Contain NASA API implementation details
        - Know about React components or frontend rendering
        - Store or log credentials
        - Trust model-generated arguments without validation
        - Execute arbitrary tool names or URLs from the model
        - Leave interactions stuck in 'processing' indefinitely

    The orchestrator SHOULD:
        - Use BaseLLMProvider for all LLM communication
        - Use ToolRegistry for tool discovery and execution
        - Translate all errors to OrchestratorErrorCode values
        - Enforce a maximum number of tool-call rounds
        - Ensure all discoveries belong to the correct SpacePlan
    """

    @abc.abstractmethod
    def execute(self, context: OrchestratorContext) -> OrchestratorResult:
        """
        Execute the full orchestration pipeline for an interaction.

        Args:
            context: The full execution context.

        Returns:
            An OrchestratorResult with the normalized response and
            any discoveries to persist.

        This method must never raise unhandled exceptions to the caller.
        All failures should be captured in OrchestratorResult with
        appropriate error_code and error_message.
        """
        ...


# ============================================================
# EXECUTION LIFECYCLE
# ============================================================
#
# The intended lifecycle for an Interaction:
#
#   1. POST /api/plans/<id>/interactions/
#      → Interaction created with status="pending"
#
#   2. Orchestrator invoked
#      → Interaction.status = "processing"
#
#   3. Orchestrator pipeline:
#      a. Build OrchestratorContext
#      b. Resolve credentials (user BYOK → app default)
#      c. Build LLM messages
#      d. Call LLM provider
#      e. Parse tool calls from response
#      f. For each tool call:
#         i.   Validate tool exists in registry
#         ii.  Validate arguments against tool schema
#         iii. Execute tool
#         iv.  Collect ToolResult
#      g. Feed results back to LLM (multi-turn loop, max rounds)
#      h. Get final response from LLM
#      i. Normalize into OrchestratorResult
#
#   4a. Success path:
#       → Persist discoveries (with deduplication via external_id)
#       → Store normalized response in Interaction.response
#       → Link added_discoveries
#       → Interaction.status = "completed"
#       → Interaction.completed_at = now()
#
#   4b. Failure path:
#       → Interaction.error_code = OrchestratorErrorCode value
#       → Interaction.status = "failed"
#       → Interaction.completed_at = now()
#       → Response contains safe error info only
#
# The architecture ensures that interactions never remain stuck in
# "processing" by always transitioning to "completed" or "failed",
# even on unexpected errors.
#
# Background execution (Celery/queues) is NOT required for Phase 5.1.
# The initial implementation may execute synchronously within the
# request cycle. Async execution can be introduced in a later phase
# if needed.
