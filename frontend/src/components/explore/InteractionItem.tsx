import type { Interaction } from '../../types/planner';
import InteractionResult from './InteractionResult';
import { MessageSquare } from 'lucide-react';

interface InteractionItemProps {
    interaction: Interaction;
}

/**
 * Renders a single interaction within the exploration stream.
 * Shows the user's follow-up prompt as contextual label + the result card.
 * Deliberately NOT a chat bubble — this is an exploration workspace.
 */
export default function InteractionItem({ interaction }: InteractionItemProps) {
    const typeLabels: Record<string, string> = {
        find_more: 'Find More',
        enrich: 'Tell Me More',
        compare: 'Compare',
        related: 'Find Related',
        other: 'Follow-up',
    };

    return (
        <div className="interaction-item">
            <div className="interaction-item__context">
                <div className="interaction-item__label">
                    <MessageSquare size={14} />
                    <span className="interaction-item__type">
                        {typeLabels[interaction.interaction_type] || 'Follow-up'}
                    </span>
                </div>
                <div className="interaction-item__prompt">{interaction.user_prompt}</div>
            </div>
            <InteractionResult interaction={interaction} />
        </div>
    );
}
