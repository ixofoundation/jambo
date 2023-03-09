import { useState, MouseEvent } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import cls from 'classnames';
import 'swiper/css';

import styles from './Swiper.module.scss';
import { ACTION } from 'types/actions';
import ImageWithFallback from '@components/ImageFallback/ImageFallback';
import useWindowDimensions from '@hooks/windowDimensions';
import { shimmerDataUrl } from '@utils/image';
import { pushNewRoute } from '@utils/router';

type SwiperProps = {
  actions: ACTION[];
  swiper?: boolean;
};

const CustomSwiper = ({ actions, swiper = true }: SwiperProps) => {
  const [active, setActive] = useState(0);
  const { width } = useWindowDimensions();

  const selectedAction = actions[active];

  const onClickNavigate = (actionId: string) => () => pushNewRoute(`/${actionId}`);

  const onSwiperNavigate = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    pushNewRoute(`/${actions[active].id}`);
  };

  if (width && width > 425)
    return (
      <div className={styles.actionGrid}>
        {actions.map((action, i) => (
          <div key={action.id} onClick={onClickNavigate(action.id)} className={styles.action}>
            <div className={styles.swiperSlide}>
              {action.image ? (
                <ImageWithFallback
                  fallbackSrc='/images/actions/fallback.png'
                  src={`/images/actions/${action.image}`}
                  alt={action.name}
                  layout='fill'
                  className={styles.actionImage}
                  placeholder='blur'
                  blurDataURL={shimmerDataUrl()}
                />
              ) : (
                <div className={styles.actionImage} />
              )}
            </div>

            <h2 className={styles.actionName}>{action.name}</h2>
            <p className={styles.actionDescription}>{action.description}</p>
          </div>
        ))}
      </div>
    );

  return (
    <div>
      {swiper ? (
        <Swiper
          spaceBetween={20}
          slidesPerView='auto'
          onSlideChange={(s) => setActive(s.activeIndex)}
          centeredSlides
          className={styles.swiper}
          initialSlide={0}
        >
          {actions.map((action, i) => (
            <SwiperSlide className={styles.swiperSlide} key={action.id} onClick={onSwiperNavigate}>
              {action.image ? (
                <ImageWithFallback
                  fallbackSrc='/images/actions/fallback.png'
                  src={`/images/actions/${action.image}`}
                  alt={action.name}
                  layout='fill'
                  className={styles.actionImage}
                />
              ) : (
                <div className={styles.actionImage} />
              )}
            </SwiperSlide>
          ))}
          <div className={styles.leftGradient} />
          <div className={styles.rightGradient} />
        </Swiper>
      ) : (
        actions.map((action, i) => (
          <div className={cls(styles.swiperSlide, styles.center)} key={action.id} onClick={onSwiperNavigate}>
            {action.image ? (
              <ImageWithFallback
                fallbackSrc='/images/actions/fallback.png'
                src={`/images/actions/${action.image}`}
                alt={action.name}
                layout='fill'
                className={styles.actionImage}
                placeholder='blur'
                blurDataURL={shimmerDataUrl()}
              />
            ) : (
              <div className={styles.actionImage} />
            )}
          </div>
        ))
      )}
      <h2 className={styles.actionName}>{selectedAction?.name}</h2>
      <p className={styles.actionDescription}>{selectedAction?.description}</p>
    </div>
  );
};

export default CustomSwiper;
