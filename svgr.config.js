// Config file for svg imports
module.exports = {
  icon: true,
  expandProps: 'end',
  dimensions: true,
  svgo: true,
  titleProp: true,
  // Ensure svg fill/stroke-color is white is want to be able to custom set color as prop
  replaceAttrValues: { '#fff': '{props.color}' },
};
