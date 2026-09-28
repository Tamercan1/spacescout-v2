import { Clock, RotateCcw, Image as ImageIcon, Target, Plus } from 'lucide-react';

export default function Explorations() {
    return (
        <div className="exps-page">
            <div className="exps-page__header">
                <div>
                    <h1 className="exps-page__title">Your Explorations</h1>
                    <div className="exps-page__sub">6 explorations - pick one to continue or start something new</div>
                </div>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}>
                    <Plus size={16} /> New exploration
                </button>
            </div>
            
            <div className="exps-scroll">
                
                <div className="exp-row">
                    <div className="exp-row__icon">
                        <Clock size={16} />
                    </div>
                    <div className="exp-row__body">
                        <div className="exp-row__title">Interesting Near-Earth Asteroids</div>
                        <div className="exp-row__meta">
                            <span>4 discoveries</span>
                            <span>1 follow-up</span>
                            <span>NASA NeoWs, APOD</span>
                            <span>Today</span>
                        </div>
                    </div>
                    <div className="exp-row__right">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></div>
                            Active
                        </div>
                    </div>
                </div>

                <div className="exp-row">
                    <div className="exp-row__icon">
                        <RotateCcw size={16} />
                    </div>
                    <div className="exp-row__body">
                        <div className="exp-row__title">Recent Solar Flare Activity</div>
                        <div className="exp-row__meta">
                            <span>9 discoveries</span>
                            <span>3 follow-ups</span>
                            <span>NASA DONKI</span>
                            <span>2 days ago</span>
                        </div>
                    </div>
                </div>

                <div className="exp-row">
                    <div className="exp-row__icon">
                        <ImageIcon size={16} />
                    </div>
                    <div className="exp-row__body">
                        <div className="exp-row__title">NASA APOD — September Highlights</div>
                        <div className="exp-row__meta">
                            <span>6 discoveries</span>
                            <span>1 follow-up</span>
                            <span>NASA APOD</span>
                            <span>4 days ago</span>
                        </div>
                    </div>
                </div>

                <div className="exp-row">
                    <div className="exp-row__icon">
                        <Target size={16} />
                    </div>
                    <div className="exp-row__body">
                        <div className="exp-row__title">Exoplanets in the Habitable Zone</div>
                        <div className="exp-row__meta">
                            <span>12 discoveries</span>
                            <span>5 follow-ups</span>
                            <span>NASA Exoplanet Archive</span>
                            <span>Sep 18</span>
                        </div>
                    </div>
                </div>

                <div className="exp-row">
                    <div className="exp-row__icon">
                        <Clock size={16} />
                    </div>
                    <div className="exp-row__body">
                        <div className="exp-row__title">Closest Approach Events This Month</div>
                        <div className="exp-row__meta">
                            <span>7 discoveries</span>
                            <span>2 follow-ups</span>
                            <span>NASA NeoWs</span>
                            <span>Sep 14</span>
                        </div>
                    </div>
                </div>

                <div className="exp-row">
                    <div className="exp-row__icon">
                        <Clock size={16} />
                    </div>
                    <div className="exp-row__body">
                        <div className="exp-row__title">Largest Known Near-Earth Objects</div>
                        <div className="exp-row__meta">
                            <span>5 discoveries</span>
                            <span>0 follow-ups</span>
                            <span>NASA NeoWs</span>
                            <span>Sep 10</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
