import PropTypes from 'prop-types'

// Tints a single-color SVG asset with the current text color.
export const MaskIcon = ({ src, className = 'h-5 w-5' }) => (
  <span
    aria-hidden="true"
    className={`inline-block shrink-0 bg-current ${className}`}
    style={{
      maskImage: `url(${src})`,
      WebkitMaskImage: `url(${src})`,
      maskSize: 'contain',
      WebkitMaskSize: 'contain',
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center',
    }}
  />
)

MaskIcon.propTypes = {
  src: PropTypes.string.isRequired,
  className: PropTypes.string,
}
