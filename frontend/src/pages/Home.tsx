import { Search, Compass, Zap, Image as ImageIcon } from 'lucide-react';

export default function Home() {
    return (
        <div className="home-page">
            <div className="home-page__eyebrow">NASA-BACKED SPACE EXPLORATION</div>
            <h1 className="home-page__title">What are you curious about today?</h1>
            
            <div className="home-start-box">
                <div className="home-start-box__row">
                    <Search size={20} color="var(--text-3)" />
                    <input 
                        type="text" 
                        className="home-start-box__input" 
                        placeholder="e.g. What asteroids are approaching Earth this year?" 
                    />
                    <button className="btn btn-primary" style={{ padding: '8px 18px', borderRadius: '99px', fontSize: '0.85rem' }}>Explore</button>
                </div>
            </div>

            <div className="home-prompts">
                <div className="home-prompt">Near-Earth asteroids</div>
                <div className="home-prompt">Solar flares</div>
                <div className="home-prompt">Today's APOD</div>
                <div className="home-prompt">Exoplanets</div>
            </div>

            <div className="home-recent">
                <div className="home-recent__label">RECENT EXPLORATIONS</div>
                <div className="home-recent__items">
                    <div className="home-recent__item">
                        <div className="home-recent__item-icon">
                            <Compass size={16} />
                        </div>
                        <div className="home-recent__item-title">Near-Earth asteroids approaching this year</div>
                        <div className="home-recent__item-count">3 discoveries</div>
                    </div>
                    <div className="home-recent__item">
                        <div className="home-recent__item-icon">
                            <Zap size={16} />
                        </div>
                        <div className="home-recent__item-title">Solar flares from the last week</div>
                        <div className="home-recent__item-count">8 discoveries</div>
                    </div>
                    <div className="home-recent__item">
                        <div className="home-recent__item-icon">
                            <ImageIcon size={16} />
                        </div>
                        <div className="home-recent__item-title">James Webb space telescope images</div>
                        <div className="home-recent__item-count">12 discoveries</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
