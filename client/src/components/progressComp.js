import React from 'react'

import PropTypes from 'prop-types'

import '../css/progress.css'

const Progress = (props) => {
    return (
        <div className={`progress-progress ${props.rootClassName} `}>
            <span className="progress-text">{props.text}</span>
            <span className="progress-text1">{props.text1}</span>
        </div>
    )
}

Progress.defaultProps = {
    text: '50%',
    rootClassName: '',
    text1: 'Tiến Độ',
}

Progress.propTypes = {
    text: PropTypes.string,
    rootClassName: PropTypes.string,
    text1: PropTypes.string,
}

export default Progress
