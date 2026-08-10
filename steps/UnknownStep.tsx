import { FC } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import IconText from '@components/IconText/IconText';
import SadFace from '@icons/sad_face.svg';

type UnknownStepProps = {
  stepId?: string;
  actionId?: string;
  index?: number;
};

/**
 * Rendered when an action references a step id that has no component.
 *
 * This case used to fall through to `<EmptySteps loading />` — an indefinite
 * spinner with no error and no console output, which is the hardest possible
 * failure to diagnose. `yarn validate:config` should catch it long before a user
 * sees this screen; if this renders, the config bypassed validation somehow.
 */
const UnknownStep: FC<UnknownStepProps> = ({ stepId, actionId, index }) => {
  const location = `actions[id=${actionId ?? '?'}].steps[${index ?? '?'}]`;

  // eslint-disable-next-line no-console
  console.error(
    `[jambo] Unknown step "${stepId}" at ${location}. ` +
      `It has no case in pages/[actionId].tsx. Run \`yarn validate:config\` and see docs/CAPABILITIES.md.`,
  );

  return (
    <>
      <Header />

      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        <IconText title={`Unknown step "${stepId ?? 'undefined'}"`} Img={SadFace} imgSize={50}>
          <p className={utilsStyles.label}>
            This step is referenced at {location} in constants/config.json but no component is wired up for it.
          </p>
          <p className={utilsStyles.label}>Run `yarn validate:config` to see the full list of valid step ids.</p>
        </IconText>
      </main>

      <Footer onBackUrl='/' backLabel='Home' />
    </>
  );
};

export default UnknownStep;
