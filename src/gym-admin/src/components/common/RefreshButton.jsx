import PropTypes from 'prop-types';

function RefreshButton({ onClick }) {
    return (
        <button type="button" className="button button--ghost" onClick={onClick}>
            Refresh
        </button>
    );
}

RefreshButton.propTypes = {
    onClick: PropTypes.func.isRequired
};

export default RefreshButton;
