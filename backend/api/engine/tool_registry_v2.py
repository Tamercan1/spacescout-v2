"""
SpaceScout V2 — Tool Registry (V2 Contract)

Provides a registry for discovering and accessing tools by name.
The orchestrator uses this registry to look up tools requested by
the LLM without needing a hardcoded conditional block.

This module defines the ToolRegistry class and provides a
module-level registry instance. New tools register themselves
by calling registry.register(tool_instance).

Adding a new NASA tool requires:
    1. Create a new BaseTool subclass (e.g. MarsRoverTool)
    2. Register it: registry.register(MarsRoverTool())
    3. The orchestrator can now use it — no orchestrator changes needed.

The existing V1 tool_registry dict in tool_registry.py is preserved.
This V2 registry will coexist during the transition and eventually
replace the V1 registry when tools are migrated to BaseTool subclasses.
"""

from __future__ import annotations

from typing import Any

from .contracts import BaseTool


class ToolRegistry:
    """
    A registry of available tools that the orchestrator can discover
    and invoke.

    The registry is keyed by tool name. Each tool must have a unique name.
    The registry provides:
        - Registration of new tools
        - Lookup by name
        - Listing all available tools
        - Generation of OpenAI-compatible tool schemas for the LLM
    """

    def __init__(self) -> None:
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        """
        Register a tool. Raises ValueError if a tool with the same
        name is already registered.
        """
        if tool.name in self._tools:
            raise ValueError(f"Tool '{tool.name}' is already registered.")
        self._tools[tool.name] = tool

    def get(self, tool_name: str) -> BaseTool | None:
        """
        Look up a tool by name. Returns None if not found.
        """
        return self._tools.get(tool_name)

    def has(self, tool_name: str) -> bool:
        """Check if a tool is registered."""
        return tool_name in self._tools

    def list_tools(self) -> list[BaseTool]:
        """Return all registered tools."""
        return list(self._tools.values())

    def get_openai_schemas(self) -> list[dict[str, Any]]:
        """
        Generate OpenAI-compatible tool schemas for all registered tools.
        This is what gets sent to the LLM provider so it knows which
        tools are available.
        """
        return [{"type": "function", "function": tool.get_openai_schema()} for tool in self._tools.values()]

    def get_tool_names(self) -> list[str]:
        """Return all registered tool names."""
        return list(self._tools.keys())

    def __len__(self) -> int:
        return len(self._tools)

    def __contains__(self, tool_name: str) -> bool:
        return tool_name in self._tools


# Module-level registry instance.
# Tools register themselves here at import time.
# The orchestrator imports this instance to discover available tools.
registry = ToolRegistry()

from .tools.nasa.apod import APODTool
from .tools.nasa.neows import NeoWsTool
from .tools.nasa.donki import DonkiTool

registry.register(APODTool())
registry.register(NeoWsTool())
registry.register(DonkiTool())
