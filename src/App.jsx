import { Suspense, useRef } from 'react'
import './App.css'
import Globe from './components/Globe'

function IconMaterial() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}

function IconTeam() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IconPrecision() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

function Nav() {
  return (
    <nav className="nav">
      <div className="nav-logo">LUNA <span>ESTIMATOR</span></div>
      <ul className="nav-links">
        <li><a href="#features">Features</a></li>
        <li><a href="#how-it-works">How It Works</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
      <button className="nav-cta">Get Started</button>
    </nav>
  )
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Powered by Luna AI
        </div>
        <h1 className="hero-title">
          LUNA<br />
          <span className="accent">ESTIMATOR</span>
        </h1>
        <p className="hero-subtitle">
          Professional construction estimation powered by AI. Upload photos, get detailed material takeoffs and cost estimates in minutes — not days.
        </p>
        <div className="hero-buttons">
          <button className="btn-primary">
            Get Started <ArrowIcon />
          </button>
          <button className="btn-secondary">Learn More</button>
          <button className="btn-secondary">Book a Demo</button>
        </div>
        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-value">50K+</div>
            <div className="stat-label">Projects Estimated</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">98%</div>
            <div className="stat-label">Accuracy Rate</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">4min</div>
            <div className="stat-label">Avg. Turnaround</div>
          </div>
        </div>
      </div>
      <div className="hero-globe-canvas">
        <Globe />
      </div>
    </section>
  )
}

function Features() {
  const features = [
    {
      icon: <IconMaterial />,
      title: 'Material Focus',
      desc: 'Comprehensive material databases covering lumber, concrete, steel, and specialty items. Always up-to-date with current market pricing.',
    },
    {
      icon: <IconTeam />,
      title: 'Built for Teams',
      desc: 'Collaborative workflows with real-time sync. Share estimates, leave comments, and track changes across your entire organization.',
    },
    {
      icon: <IconPrecision />,
      title: 'Unmatched Precision',
      desc: 'Our AI achieves 98%+ accuracy on material takeoffs. Reduce costly on-site errors and win more bids with confidence.',
    },
  ]

  return (
    <section className="features" id="features">
      <div className="features-header">
        <div className="section-label">Why Luna Estimator</div>
        <h2 className="section-title">Everything you need to<br />estimate faster</h2>
        <p className="section-subtitle">
          From photo upload to detailed report in under 5 minutes. Luna handles the complexity so you can focus on winning work.
        </p>
      </div>
      <div className="features-grid">
        {features.map((f, i) => (
          <div className="feature-card" key={i}>
            <div className="feature-icon">{f.icon}</div>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Upload Photos',
      desc: 'Snap a few photos of your job site or upload existing plans. Our AI works with any image format.',
    },
    {
      num: '02',
      title: 'AI Analysis',
      desc: 'Luna\'s computer vision identifies materials, measures quantities, and cross-references your specifications.',
    },
    {
      num: '03',
      title: 'Detailed Report',
      desc: 'Receive a complete estimate with material takeoffs, quantities, unit costs, and total project cost breakdown.',
    },
  ]

  return (
    <section className="how-it-works" id="how-it-works">
      <div className="features-header">
        <div className="section-label">Process</div>
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">
          Three simple steps to a complete, professional estimate.
        </p>
      </div>
      <div className="hiw-grid">
        {steps.map((step, i) => (
          <div className="hiw-step" key={i}>
            <div className="hiw-number">{step.num}</div>
            <h3 className="hiw-title">{step.title}</h3>
            <p className="hiw-desc">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="cta-section" id="contact">
      <div className="cta-box">
        <h2 className="cta-title">Start Estimating Today</h2>
        <p className="cta-subtitle">
          Join thousands of contractors who trust Luna Estimator for accurate, fast construction cost estimates.
        </p>
        <form className="cta-form" onSubmit={e => e.preventDefault()}>
          <input
            type="email"
            className="cta-input"
            placeholder="Enter your work email"
          />
          <button type="submit" className="cta-submit">Get Started</button>
        </form>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <span className="footer-brand">Luna Estimator</span>
        <span className="footer-text">© 2024 Luna Estimator. All rights reserved.</span>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <div className="app">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  )
}
