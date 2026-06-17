import PropTypes from 'prop-types';
import { FaUsers, FaUserTie, FaMicrophone, FaChartBar, FaTachometerAlt } from 'react-icons/fa';

function Sidebar({ activeView, entries, onSelectView, isOpen = false, onClose = () => { } }) {
    const iconMap = {
        memberships: <FaUsers />,
        trainers: <FaUserTie />,
        pitches: <FaMicrophone />,
        reports: <FaChartBar />,
        performance: <FaTachometerAlt />
    };

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
            <div className="sidebar__brand">
                <span className="sidebar__logo">GYM</span>
                <div>
                    <p className="sidebar__title">Gym Admin</p>
                    <p className="sidebar__subtitle">Control Center</p>
                </div>
            </div>
            <nav className="sidebar__nav">
                {Object.entries(entries).map(([key, meta]) => {
                    const isActive = key === activeView;
                    return (
                        <button
                            type="button"
                            key={key}
                            className={`sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
                            onClick={() => onSelectView(key)}
                        >
                            <span className="sidebar__nav-icon">{iconMap[key]}</span>
                            {meta.label}
                        </button>
                    );
                })}
            </nav>
            <button className="sidebar__close" onClick={onClose} aria-label="Close menu">
                ×
            </button>
        </aside>
    );
}

Sidebar.propTypes = {
    activeView: PropTypes.string.isRequired,
    entries: PropTypes.objectOf(
        PropTypes.shape({
            label: PropTypes.string.isRequired
        })
    ).isRequired,
    onSelectView: PropTypes.func.isRequired,
    isOpen: PropTypes.bool,
    onClose: PropTypes.func
};

export default Sidebar;
