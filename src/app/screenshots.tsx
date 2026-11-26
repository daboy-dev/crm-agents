import type { PipelineScreenshot as Shot } from "@/server/pipeline/queries";

/** Screenshots of an E2E report at 1280 and 390 px (H2, D45). */
export function Screenshots({ shots }: { shots: Shot[] }) {
  if (shots.length === 0) return null;
  const widths = [...new Set(shots.map((s) => s.width))].sort((a, b) => b - a);
  return (
    <div className="shots">
      {widths.map((width) => (
        <section key={width} data-testid={`shots-${width}`}>
          <h4>{width} px</h4>
          <ul className={`shot-grid shot-grid-${width}`}>
            {shots
              .filter((s) => s.width === width)
              .map((shot) => (
                <li key={shot.id}>
                  <a
                    href={`/api/screenshots/${shot.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {/* Private, session-bound images: next/image would cache them publicly. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/screenshots/${shot.id}`}
                      alt={`${shot.page} a ${width} px`}
                      loading="lazy"
                    />
                    <span>{shot.page}</span>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
