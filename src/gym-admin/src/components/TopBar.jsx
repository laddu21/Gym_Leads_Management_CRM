import PropTypes from 'prop-types';
import RefreshButton from './common/RefreshButton.jsx';


function TopBar({ onRefresh = undefined, subtitle = '', title, onToggleMenu = () => { }, isMenuOpen = false }) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="hamburger" onClick={onToggleMenu} aria-label="Toggle menu">
          <span className={`hamburger__line ${isMenuOpen ? 'hamburger__line--open' : ''}`}></span>
          <span className={`hamburger__line ${isMenuOpen ? 'hamburger__line--open' : ''}`}></span>
          <span className={`hamburger__line ${isMenuOpen ? 'hamburger__line--open' : ''}`}></span>
        </button>
        <div>
          <h1 className="topbar__title">{title}</h1>
          {subtitle ? <p className="topbar__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {onRefresh ? (
        <RefreshButton onClick={onRefresh} />
      ) : null}
    </header>
  );
}

TopBar.propTypes = {
  onRefresh: PropTypes.func,
  subtitle: PropTypes.string,
  title: PropTypes.string.isRequired,
  onToggleMenu: PropTypes.func,
  isMenuOpen: PropTypes.bool
};

export default TopBar;
