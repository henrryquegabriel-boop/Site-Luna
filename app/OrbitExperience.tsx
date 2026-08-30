export function OrbitExperience() {
  return (
    <div
      className="orbit-system"
      data-celestial-depth="1"
      data-celestial-motion
      data-celestial-phase="0.3"
    >
      <div className="celestial-orbit orbit-slow" aria-hidden="true">
        <span className="orbit-object orbit-moon">☾</span>
        <span className="orbit-object orbit-star orbit-star-one">✦</span>
      </div>
      <div className="celestial-orbit orbit-medium" aria-hidden="true">
        <span className="orbit-object orbit-star orbit-star-two">✧</span>
        <span className="orbit-object orbit-star orbit-star-three">✦</span>
      </div>
      <div className="celestial-orbit orbit-fast" aria-hidden="true">
        <span className="orbit-object orbit-star orbit-star-four">✦</span>
        <span className="orbit-object orbit-star orbit-star-five">✧</span>
      </div>

    </div>
  );
}
