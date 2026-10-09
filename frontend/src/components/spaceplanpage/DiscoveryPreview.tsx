import type { Discovery } from "../../types/planner";
import { formatToShortDate } from "../../func/parsedate";
import { typeMap } from "../../func/assets";
import "../../styles/DiscoveryPreview.css";

interface DiscoveryProp {
    discovery: Discovery;
    setSelectedDiscoveryCard: (discovery: Discovery) => void;
}

function DiscoveryPreview({discovery, setSelectedDiscoveryCard}: DiscoveryProp) {
    const effectiveType = discovery.source || discovery.type || "general";
    const label = typeMap[effectiveType] || typeMap[discovery.type] || "Discovery";

    return (
        <div 
            className={`discovery-preview ${effectiveType}`}
            key={discovery.id}
            onClick={() => {
                if (window.getSelection()?.toString()) return
                setSelectedDiscoveryCard(discovery)
            }}
        >   
            <div className="date-type">
                <span className={`strong-${effectiveType}`}>{label}</span>
                <span className="soft"> 
                    {formatToShortDate(discovery.date)} 
                </span>
            </div>
            <h3>{discovery.title}</h3>
            <p className="soft">{discovery.summary ? discovery.summary.slice(0, 110) + "..." : ""}</p>
            <button><strong className={`strong-${effectiveType}`}>View details</strong></button>
        </div>
    )
}

export default DiscoveryPreview;