import { Link, getRouteApi } from '@tanstack/react-router'
import { MicVocal, Printer, WifiOff } from 'lucide-react'
import { preload } from 'react-dom'
import { useT } from '#/lib/i18n'
import archivo from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2?url'

const rootRoute = getRouteApi('__root__')
const source = 'https://github.com/MelvinVermeer/gigg'

/** Front page for signed-out visitors (and anyone without a band). Styles: `.home` in styles.css. */
export function Homepage() {
  // Fetch the display font alongside the CSS; its @font-face (styles.css) never swaps late, so nothing shifts.
  preload(archivo, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
  const t = useT()
  const { locale, signupOpen } = rootRoute.useLoaderData()
  const h = t.home
  // Screenshots of the demo band in public/home, per theme and language. Show mode is always dark.
  const src = (name: string, theme = 'dark') => `/home/${name.replace('{t}', theme)}${locale === 'nl' ? '-nl' : ''}.webp`
  const Shot = ({ name, alt, lazy }: { name: string; alt: string; lazy?: boolean }) => (
    <>
      <img className="logo-on-light" src={src(name, 'light')} alt={alt} width={780} height={1688} loading={lazy ? 'lazy' : undefined} />
      <img className="logo-on-dark" src={src(name, 'dark')} alt={alt} width={780} height={1688} loading={lazy ? 'lazy' : undefined} />
    </>
  )
  const factIcons = [MicVocal, WifiOff, Printer]

  return (
    <main className="home">
      <div className="home-hero">
        <div className="home-wrap">
          <p className="home-eyebrow">{h.eyebrow}</p>
          <h1>
            {h.titleA} <em>{h.titleEm}</em> {h.titleB}
          </h1>
          <p className="home-lede">{h.lede}</p>
          <div className="home-ctas">
            <Link className="home-btn" to={signupOpen ? '/signup' : '/login'}>
              {h.start}
            </Link>
            <a className="home-btn home-btn-ghost" href={source}>
              {h.host}
            </a>
          </div>
          <div className="home-stage" aria-hidden>
            <div className="home-phone home-p2">
              <Shot name="phone-{t}-events" alt="" />
            </div>
            <div className="home-phone home-p3">
              <Shot name="phone-{t}-setlist" alt="" />
            </div>
            <div className="home-phone home-p1">
              <img src={src('phone-dark-show')} alt="" width={780} height={1688} />
            </div>
          </div>
        </div>
      </div>

      <div className="home-strip" aria-hidden>
        <div className="home-strip-track">
          {[...h.strip, ...h.strip].map((word, i) => (
            <span key={i}>{word}</span>
          ))}
        </div>
      </div>

      <section id="night">
        <div className="home-wrap">
          <p className="home-eyebrow">{h.runEyebrow}</p>
          <h2>{h.runTitle}</h2>
          <p className="home-intro">{h.runIntro}</p>
          <div className="home-runsheet">
            {h.steps.map((step, i) => (
              <article className="home-slot" key={step.title}>
                <p className="home-when">{step.when}</p>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  <ul>
                    {step.chips.map((chip) => (
                      <li key={chip}>{chip}</li>
                    ))}
                  </ul>
                </div>
                <div className="home-shot">
                  <Shot name={['phone-{t}-event', 'phone-{t}-participants', 'phone-{t}-setlist'][i]} alt={step.alt} lazy />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-showcase">
        <div className="home-wrap home-show-grid">
          <div className="home-big">
            <img src={src('desk-dark-show')} alt={h.showAlt} width={2560} height={1640} loading="lazy" />
          </div>
          <div>
            <p className="home-eyebrow">{h.showEyebrow}</p>
            <h2>{h.showTitle}</h2>
            <p className="home-intro">{h.showIntro}</p>
            <div className="home-facts">
              {h.facts.map((fact, i) => {
                const Icon = factIcons[i]
                return (
                  <div className="home-fact" key={fact.title}>
                    <span className="home-icon">
                      <Icon aria-hidden />
                    </span>
                    <div>
                      <b>{fact.title}</b>
                      <span>{fact.text}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="home-wrap">
          <p className="home-eyebrow">{h.builtEyebrow}</p>
          <h2>{h.builtTitle}</h2>
          <div className="home-grid3">
            {h.built.map((cell) => (
              <div className="home-cell" key={cell.title}>
                <h3>{cell.title}</h3>
                <p>{cell.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="home-wrap">
          <div className="home-closer">
            <h2>{h.closeTitle}</h2>
            <div>
              <p>{h.closeText}</p>
              <div className="home-ctas">
                <Link className="home-btn" to="/login">
                  {t.header.signIn}
                </Link>
                <a className="home-btn home-btn-ghost" href={source}>
                  {h.github}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="home-wrap home-footer">
        <span>Gigg · {h.footer}</span>
        <span>
          <a href={source}>{h.source}</a> · {h.installable}
        </span>
      </footer>
    </main>
  )
}
