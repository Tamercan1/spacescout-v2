import json
import logging
from typing import Any

from api.engine.contracts import (
    BaseOrchestrator,
    OrchestratorContext,
    OrchestratorResult,
    OrchestratorErrorCode,
    BaseLLMProvider,
    LLMMessage,
    ToolCall,
    ToolResult,
    ToolExecutionError,
    ToolExecutionContext,
    ResultType
)
from api.engine.tool_registry_v2 import ToolRegistry

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 8


class GenericOrchestrator(BaseOrchestrator):
    def __init__(self, provider: BaseLLMProvider, registry: ToolRegistry):
        self.provider = provider
        self.registry = registry

    def _build_initial_messages(self, context: OrchestratorContext) -> list[LLMMessage]:
        system_content = (
            "You are SpaceScout AI. "
            f"Use the available tools to help the user with their exploration: {context.space_plan_title}. "
            f"Summary: {context.space_plan_summary}"
        )
        messages = [
            LLMMessage(role="system", content=system_content)
        ]

        if context.existing_discoveries:
            messages.append(LLMMessage(
                role="system",
                content=f"Existing discoveries in this plan:\n{json.dumps(context.existing_discoveries)}"
            ))

        if context.target_discoveries:
            messages.append(LLMMessage(
                role="system",
                content=f"Target discoveries referenced by the user:\n{json.dumps(context.target_discoveries)}"
            ))

        messages.append(LLMMessage(role="user", content=context.user_prompt))
        return messages

    def execute(self, context: OrchestratorContext) -> OrchestratorResult:
        messages = self._build_initial_messages(context)
        tools_schema = self.registry.get_openai_schemas()
        
        tool_context = ToolExecutionContext(
            space_plan_id=context.space_plan_id,
            user_id=context.user_id
        )

        all_discoveries = []
        all_tool_results = []
        for round_idx in range(MAX_TOOL_ROUNDS):
            try:
                llm_response = self.provider.generate(
                    messages=messages,
                    tools=tools_schema if tools_schema else None,
                    model=context.preferred_model if context.preferred_model else None
                )
            except Exception as e:
                error_code = getattr(e, "error_code", OrchestratorErrorCode.UNEXPECTED_ERROR)
                error_msg = str(e) if hasattr(e, "error_code") else "Unexpected provider error."
                return OrchestratorResult(
                    success=False,
                    error_code=error_code,
                    error_message=error_msg
                )

            if llm_response.tool_calls:
                assistant_tool_calls = []
                for i, tc in enumerate(llm_response.tool_calls):
                    assistant_tool_calls.append({
                        "id": f"call_{round_idx}_{i}",
                        "type": "function",
                        "function": {
                            "name": tc.tool_name,
                            "arguments": json.dumps(tc.arguments)
                        }
                    })
                messages.append(LLMMessage(
                    role="assistant",
                    content=llm_response.content,
                    tool_calls=assistant_tool_calls
                ))
            else:
                messages.append(LLMMessage(role="assistant", content=llm_response.content))
                break

            # Execute tool calls
            for i, tc in enumerate(llm_response.tool_calls):
                call_id = f"call_{round_idx}_{i}"
                
                if not self.registry.has(tc.tool_name):
                    messages.append(LLMMessage(
                        role="tool",
                        content=json.dumps({"error": f"Unknown tool requested: {tc.tool_name}"}),
                        tool_call_id=call_id
                    ))
                    continue

                tool = self.registry.get(tc.tool_name)
                
                try:
                    if not isinstance(tc.arguments, dict):
                        raise ValueError("Tool arguments must be a dictionary")
                    validated_args = tool.validate_arguments(tc.arguments)
                except ValueError as ve:
                    messages.append(LLMMessage(
                        role="tool",
                        content=json.dumps({"error": f"Invalid arguments: {str(ve)}"}),
                        tool_call_id=call_id
                    ))
                    continue

                try:
                    tool_result: ToolResult = tool.execute(tool_context, **validated_args)
                    
                    if tool_result.discoveries:
                        all_discoveries.extend(tool_result.discoveries)
                    all_tool_results.append(tool_result)
                        
                    tool_response_content = json.dumps({
                        "data": tool_result.data,
                        "metadata": tool_result.metadata
                    })
                    messages.append(LLMMessage(
                        role="tool",
                        content=tool_response_content,
                        tool_call_id=call_id
                    ))
                    
                except ToolExecutionError as tee:
                    all_tool_results.append(ToolResult(
                        tool_name=tc.tool_name,
                        result_type="error",
                        data={"error": str(tee)},
                        metadata={"success": False, "error_code": tee.error_code}
                    ))
                    messages.append(LLMMessage(
                        role="tool",
                        content=json.dumps({"error": str(tee)}),
                        tool_call_id=call_id
                    ))
                except Exception as ex:
                    logger.error(f"Unexpected tool failure: {ex}")
                    all_tool_results.append(ToolResult(
                        tool_name=tc.tool_name,
                        result_type="error",
                        data={"error": "Unexpected tool execution failure."},
                        metadata={"success": False, "error_code": OrchestratorErrorCode.TOOL_EXECUTION_FAILED}
                    ))
                    messages.append(LLMMessage(
                        role="tool",
                        content=json.dumps({"error": "Unexpected tool execution failure."}),
                        tool_call_id=call_id
                    ))
        else:
            return OrchestratorResult(
                success=False,
                error_code=OrchestratorErrorCode.MAX_TOOL_ROUNDS_EXCEEDED,
                error_message="The model exceeded the maximum number of tool iterations."
            )

        # Provide a generic analysis result containing the final assistant message
        final_content = ""
        if llm_response and llm_response.content:
            final_content = llm_response.content

        return OrchestratorResult(
            success=True,
            discoveries=all_discoveries,
            tool_results=all_tool_results,
            llm_content=final_content
        )
