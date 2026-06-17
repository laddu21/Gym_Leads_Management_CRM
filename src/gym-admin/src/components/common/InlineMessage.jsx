import PropTypes from 'prop-types';

function InlineMessage({ tone = 'info', children }) {
    return <div className={`inline-message inline-message--${tone}`}>{children}</div>;
}

InlineMessage.propTypes = {
    children: PropTypes.node.isRequired,
    tone: PropTypes.oneOf(['info', 'success', 'warning', 'danger'])
};

export default InlineMessage;
