import React from 'react';
import { homepageImages } from '../../config/homepageImages';

const slideImages = homepageImages.slides && homepageImages.slides.length > 0
  ? homepageImages.slides
  : [homepageImages.hero];

const Home = () => (
  <div className="mau-home-page">
    <div className="mau-home-main">
      <section className="mau-campus-visual" aria-label="Mekdela Amba University campus gallery">
        {slideImages.map((image, index) => {
          const altText = index === 0
            ? 'Mekdela Amba University campus'
            : index === 1
              ? 'Mekdela Amba University gallery imagegs'
              : 'Mekdela Amba University gallery imagefs';

          return (
            <div
              key={`${image}-${index}`}
              className="mau-campus-slide"
              style={{ '--slide-index': index }}
            >
              <img src={image} alt={altText} />
            </div>
          );
        })}
      </section>
    </div>

    <style>{`
      .mau-home-page {
        min-height: 100vh;
      }

      .mau-home-main {
        width: 100%;
      }

      .mau-campus-visual {
        position: relative;
        width: 100%;
        min-height: 100vh;
        overflow: hidden;
        background: #17212b;
      }

      .mau-campus-slide {
        position: absolute;
        inset: 0;
        overflow: hidden;
        opacity: 0;
        animation: mau-campus-slide-show ${slideImages.length * 5}s infinite;
        animation-delay: calc(var(--slide-index) * 5s);
      }

      .mau-campus-visual img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        animation: mau-campus-image-drift 5s ease-in-out infinite;
      }

      @keyframes mau-campus-slide-show {
        0%, 5% { opacity: 0; }
        12%, 30% { opacity: 1; }
        37%, 100% { opacity: 0; }
      }

      @keyframes mau-campus-image-drift {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }

      @media (prefers-reduced-motion: reduce) {
        .mau-campus-slide,
        .mau-campus-visual img {
          animation: none;
        }

        .mau-campus-slide:first-child {
          opacity: 1;
        }
      }

      @media (max-width: 768px) {
        .mau-campus-slide {
          min-height: 40vh;
        }
      }
    `}</style>
  </div>
);

export default Home;
