import PropTypes from 'prop-types';

function EmptyState({ title, message = '', actionLabel = '', onAction = undefined }) {
    return (
        <div className="empty-state">
            <h3>{title}</h3>
            {message ? <p>{message}</p> : null}
            {onAction && actionLabel ? (
                <button type="button" className="button" onClick={onAction}>
                    {actionLabel}
                </button>
            ) : null}
        </div>
    );
}

EmptyState.propTypes = {
    actionLabel: PropTypes.string,
    message: PropTypes.string,
    onAction: PropTypes.func,
    title: PropTypes.string.isRequired
};

export default EmptyState;
