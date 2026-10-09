import json
import logging
from typing import Any
from datetime import date

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
    DiscoveryData,
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
        current_date = date.today().isoformat()
        system_content = (
            "You are SpaceScout AI. "
            f"Use the available tools to help the user with their exploration: {context.space_plan_title}. "
            f"Today's date is {current_date}. Always use real, accurate dates when calling tools. "
            "IMPORTANT: When calling tools, you MUST use the native JSON tool calling format. DO NOT output tool calls as XML or text (e.g., no <dots_function_call> or <function_call> tags). "
            f"Summary: {context.space_plan_summary}\n\n"
            "TOOL CALLING AND FAILURE GUIDELINES:\n"
            "1. Only invoke tools that directly fulfill the user's explicit request. For example, if the user asks for solar flares, only invoke 'donki'. Never call unrelated tools like 'neows' or 'apod'.\n"
            "2. If a tool fails or returns an error, do NOT repeatedly invoke the same tool with identical arguments. Report the error directly and honestly to the user.\n"
            "3. Never silently replace a failed tool's results with unrelated discoveries (e.g. do not show asteroids when a solar flare request fails). Never invent or fabricate discoveries.\n"
            "4. If the requested data cannot be retrieved due to service unavailability or network errors, inform the user clearly."
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

        if getattr(context, 'previous_interactions', None):
            for p_int in context.previous_interactions:
                messages.append(LLMMessage(role="user", content=p_int.user_prompt))
                
                parts = [p_int.assistant_response_summary]
                if p_int.target_discoveries:
                    refs = ", ".join(f"{d.get('title', 'Unknown')} (ID: {d.get('id', '')})" for d in p_int.target_discoveries)
                    parts.append(f"[Targeted context: {refs}]")
                if p_int.added_discoveries:
                    refs = ", ".join(f"{d.get('title', 'Unknown')} (ID: {d.get('id', '')})" for d in p_int.added_discoveries)
                    parts.append(f"[Generated context: {refs}]")
                    
                messages.append(LLMMessage(role="assistant", content="\n".join(parts)))

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
        failed_tool_signatures: set[str] = set()

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

                call_sig = f"{tc.tool_name}:{json.dumps(validated_args, sort_keys=True)}"
                if call_sig in failed_tool_signatures:
                    logger.warning(f"Blocking repeated invocation of failed tool call: {call_sig}")
                    messages.append(LLMMessage(
                        role="tool",
                        content=json.dumps({"error": f"Tool '{tc.tool_name}' already failed with these arguments in this session. Do not retry identical failing calls."}),
                        tool_call_id=call_id
                    ))
                    continue

                try:
                    tool_result: ToolResult = tool.execute(tool_context, **validated_args)
                    
                    if tool_result.result_type == "error" or not tool_result.metadata.get("success", True):
                        failed_tool_signatures.add(call_sig)

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
                    failed_tool_signatures.add(call_sig)
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
                    failed_tool_signatures.add(call_sig)
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

        # Post-tool LLM enrichment pass: generate custom, non-generic why_interesting for discoveries
        if all_discoveries:
            self._enrich_discoveries_why_interesting(all_discoveries)

        return OrchestratorResult(
            success=True,
            discoveries=all_discoveries,
            tool_results=all_tool_results,
            llm_content=final_content
        )

    def _enrich_discoveries_why_interesting(self, discoveries: list[DiscoveryData]) -> None:
        """
        Executes a focused LLM enrichment pass to generate compelling, 
        custom 'why_interesting' scientific hooks for each discovered item.
        Adheres to strict LLM-only policy (remains blank if omitted or failed).
        """
        if not discoveries:
            return

        items_payload = []
        for d in discoveries:
            if not d.external_id:
                continue
            item = {
                "id": str(d.external_id),
                "title": d.title,
                "type": d.source,
                "date": d.date or "N/A",
                "summary": d.summary or "",
            }
            if d.facts:
                item["facts"] = d.facts
            items_payload.append(item)

        if not items_payload:
            return

        enrichment_prompt = (
            "You are SpaceScout's astronomical science curator. For each discovery below, provide a custom, engaging 'why_interesting' explanation.\n\n"
            "Guidelines:\n"
            "- Write 1 to 2 punchy, dynamic sentences highlighting cosmic significance, uniqueness, or observational wonder.\n"
            "- Avoid repetitive boilerplate or generic formulaic phrasing (do NOT use phrases like 'Classified as an X-class flare' or 'With an estimated diameter of').\n"
            "- Focus on why a human space explorer would find this cosmic event or object fascinating.\n"
            "- Return ONLY a JSON object mapping each discovery id to its why_interesting explanation, with format:\n"
            '{\n  "<id>": "explanation text"\n}'
        )

        messages = [
            LLMMessage(role="system", content=enrichment_prompt),
            LLMMessage(role="user", content=json.dumps(items_payload, indent=2))
        ]

        try:
            response = self.provider.generate(
                messages=messages,
                tools=None
            )
            raw_text = (response.content or "").strip()
            # Clean markdown code blocks if present
            if raw_text.startswith("```"):
                lines = raw_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                raw_text = "\n".join(lines).strip()

            insights_map = json.loads(raw_text)
            if isinstance(insights_map, dict):
                for d in discoveries:
                    if d.external_id and str(d.external_id) in insights_map:
                        insight = insights_map[str(d.external_id)]
                        if isinstance(insight, str) and insight.strip():
                            d.why_interesting = insight.strip()
        except Exception as e:
            logger.warning(f"Failed to generate LLM why_interesting enrichment: {e}")
            # Strict LLM-only policy: remains empty string if LLM fails
