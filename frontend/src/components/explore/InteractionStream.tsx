import type { Interaction } from '../../types/planner';
import InteractionItem from './InteractionItem';

interface InteractionStreamProps {
    interactions: Interaction[];
}

/**
 * Renders the chronological stream of follow-up interactions.
 * Each interaction is rendered as a contextual workspace entry, not a chat message.
 */
export default function InteractionStream({ interactions }: InteractionStreamProps) {
    if (interactions.length === 0) {
        return null;
    }

    return (
        <div className="interaction-stream">
            <div className="feed-label">
                <span className="feed-label__text">Follow-up interactions</span>
                <span className="feed-label__line"></span>
                <span className="feed-label__count">{interactions.length}</span>
            </div>
            {interactions.map(interaction => (
                <InteractionItem key={interaction.id} interaction={interaction} />
            ))}
        </div>
    );
}
