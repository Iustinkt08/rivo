// Lets TypeScript understand `import Icon from './foo.svg'` as a React component,
// matching the react-native-svg-transformer setup in metro.config.js.
declare module '*.svg' {
  import type { SvgProps } from 'react-native-svg';
  import type { FC } from 'react';
  const content: FC<SvgProps>;
  export default content;
}
