import type { Portfolio } from './schema';

/**
 * Every career fact lives here and nowhere else (shared/02, north-star B9).
 *
 * Source: the owner's public GitHub profile README (github.com/Jaswanthnarravula), retrieved 2026-09-21. LinkedIn
 * is the owner's primary source but blocks anonymous retrieval; facts it alone holds (employment dates, the IBM
 * role title, locations) stay `null` and the entry is marked `placeholder` until the owner supplies them.
 * UI code must read this module through `data/selectors` only (lint-enforced).
 */
export const portfolio = {
  person: {
    name: 'Jaswanth Narravula',
    givenName: 'Jaswanth',
    headline: 'Backend engineer — identity, distributed systems and data-intensive services',
    role: 'Software Engineer',
    location: 'Sugar Land, Texas',
    summary: [
      'I build the backend systems other applications depend on — identity providers, service boundaries, and the data layer underneath them.',
      'At Xclusive Trading Inc. I engineered a standards-based OAuth 2.1 / OpenID Connect provider in Go that is the central single sign-on for internal applications, decomposed a production platform into isolated microservices, and cut report generation time by roughly 60% through PostgreSQL tuning.',
      'Before that, at IBM, I built REST APIs for a corporate loan processing platform for DBS Bank. I hold an M.S. in Computer Science from the University of Alabama at Birmingham.',
    ],
    openTo: 'Open to backend and distributed-systems roles.',
  },
  contact: {
    email: 'jaswanthnarravula@gmail.com',
    links: [
      {
        kind: 'linkedin',
        label: 'LinkedIn',
        url: 'https://www.linkedin.com/in/jaswanth-narravula/',
        handle: 'in/jaswanth-narravula',
      },
      {
        kind: 'github',
        label: 'GitHub',
        url: 'https://github.com/Jaswanthnarravula',
        handle: '@Jaswanthnarravula',
      },
    ],
  },
  experience: [
    {
      slug: 'xclusive-trading',
      company: 'Xclusive Trading Inc.',
      role: 'Software Engineer',
      start: null,
      end: 'present',
      location: null,
      summary: 'Builds the identity provider, service boundaries and data layer that internal applications depend on.',
      highlights: [
        'Engineered a standards-based OAuth 2.1 / OpenID Connect provider in Go — authorization code flow with PKCE, refresh-token rotation, RS256-signed JWTs, automated JWKS key rotation, Argon2id credential hashing and RBAC — now the central SSO provider delivering single sign-on to 3,000+ users.',
        'Decomposed a production platform into 6 microservices with isolated failure domains, and rebuilt its ETL workflows to be idempotent and replay-safe with exponential backoff.',
        'Cut report-generation time by ~60% through PostgreSQL execution-plan analysis, targeted indexing, query optimization and denormalized reporting tables over 50M+ rows, supporting 8+ production services.',
        'Built stateless REST APIs secured with Microsoft Entra ID SSO over OIDC, RS256 JWT validation and route-level RBAC, sustaining sub-200 ms p95 latency with per-IP rate limiting, CSRF protection, HSTS/CSP and audit logging.',
      ],
      stack: [
        'Go',
        'Python',
        'FastAPI',
        'Flask',
        'PostgreSQL',
        'Redis',
        'Elasticsearch',
        'React',
        'Docker',
        'Nginx',
        'Microsoft Entra ID',
      ],
      placeholder: true,
    },
    {
      slug: 'ibm',
      company: 'IBM',
      client: 'DBS Bank',
      role: null,
      start: null,
      end: null,
      location: null,
      summary: 'Built production REST APIs for a corporate loan processing platform for DBS Bank.',
      highlights: [
        'Delivered 10+ production REST APIs automating loan intake, eligibility validation and multi-stage approvals.',
        'Built the platform around a state-driven workflow engine with optimistic locking, so concurrent approvals could not land in invalid states.',
        'Reduced API response times by 30%.',
      ],
      stack: ['Java 17', 'Spring Boot', 'JPA / Hibernate', 'MySQL', 'Redis', 'JUnit 5', 'Mockito'],
      placeholder: true,
    },
  ],
  projects: [
    {
      slug: 'enterprise-sso',
      name: 'Enterprise SSO Identity Provider',
      tagline: 'An OAuth 2.1 + OpenID Connect provider written from scratch in Go.',
      context: 'Xclusive Trading Inc.',
      description: [
        'A standards-based identity provider implementing the same protocols as Entra ID, Okta and Google Cloud IAM — not a wrapper around them.',
        'It is the central single sign-on provider for internal applications, delivering SSO to 3,000+ users.',
      ],
      highlights: [
        'Authorization code flow with PKCE and refresh-token rotation',
        'RS256-signed JWTs with automatic JWKS key rotation',
        'Argon2id credential hashing and 4-tier RBAC',
        'Admin session management and 15+ client integration examples',
      ],
      stack: ['Go 1.22', 'Chi v5', 'PostgreSQL', 'RS256 JWT', 'Argon2id', 'Nginx', 'systemd'],
      featured: true,
      closedSource: true,
    },
    {
      slug: 'sales-platform',
      name: 'Full-Stack Sales Platform',
      tagline: 'An internal sales platform in daily production use.',
      context: 'Xclusive Trading Inc.',
      description: [
        'A React + Vite frontend over 6 independent Python microservices with isolated failure boundaries.',
        'Roles propagate as JWTs from the internal SSO provider; ETL pipelines are replayable, so a retried or partially failed batch reprocesses cleanly instead of writing duplicates.',
      ],
      highlights: [
        '6 microservices with isolated failure domains',
        'JWT role propagation from the internal SSO provider',
        'Idempotent, replay-safe ETL with exponential backoff',
      ],
      stack: ['React', 'Vite', 'Python', 'Flask', 'FastAPI', 'PostgreSQL', 'REST'],
      featured: true,
      closedSource: true,
    },
    {
      slug: 'workforce-management',
      name: 'Workforce Management Backend',
      tagline: 'An async-first FastAPI backend serving every internal management tier.',
      context: 'Xclusive Trading Inc.',
      description: [
        'Azure AD SSO over OIDC, real-time WebSocket notifications with heartbeat and reconnection, and calendar scheduling with recurrence rules.',
      ],
      highlights: [
        'Azure AD single sign-on over OIDC',
        'WebSocket notifications with heartbeat and reconnection',
        '4-tier route-level RBAC',
        'Calendar scheduling with recurrence rules',
      ],
      stack: ['Python', 'FastAPI', 'PostgreSQL', 'SQLAlchemy', 'WebSockets', 'Azure AD', 'Docker'],
      featured: false,
      closedSource: true,
    },
    {
      slug: 'price-intelligence',
      name: 'Price Intelligence Platform',
      tagline: 'An asynchronous ingestion pipeline over unreliable external sources.',
      context: 'Xclusive Trading Inc.',
      description: [
        'Celery and Redis orchestrate ingestion tasks with retry and failure handling; Elasticsearch powers fuzzy search and cross-retailer ranking, with price-history analytics on top.',
      ],
      highlights: [
        'Celery/Redis task orchestration with retries and failure handling',
        'Elasticsearch fuzzy search and cross-retailer ranking',
        'Price-history analytics',
      ],
      stack: ['FastAPI', 'Celery', 'Redis', 'Elasticsearch', 'PostgreSQL', 'Docker Compose'],
      featured: false,
      closedSource: true,
    },
    {
      slug: 'loan-processing',
      name: 'Corporate Loan Processing Platform',
      tagline: 'Production REST APIs for corporate loan intake and approvals.',
      context: 'IBM · DBS Bank',
      description: [
        '10+ production REST APIs automating loan intake, eligibility validation and multi-stage approvals.',
        'Built around a state-driven workflow engine with optimistic locking, so concurrent approvals cannot land in invalid states.',
      ],
      highlights: [
        '10+ production REST APIs',
        'State-driven workflow engine with optimistic locking',
        'API response times reduced 30%',
      ],
      stack: ['Java 17', 'Spring Boot', 'JPA / Hibernate', 'MySQL', 'Redis', 'JUnit 5', 'Mockito'],
      featured: true,
      closedSource: true,
    },
    {
      slug: 'asl-gesture-recognition',
      name: 'ASL Gesture Recognition',
      tagline: 'A PyTorch pipeline for 24 static American Sign Language gestures.',
      context: 'Graduate research · UAB',
      description: [
        'Transfer learning with ResNet-18 lifted test accuracy from 13.21% to 43.36% and macro-F1 from 0.081 to 0.351.',
        'Macro-F1 was tracked alongside accuracy so class imbalance could not hide the gains.',
      ],
      highlights: ['Test accuracy 13.21% → 43.36%', 'Macro-F1 0.081 → 0.351', 'Transfer learning with ResNet-18'],
      stack: ['Python', 'PyTorch', 'ResNet-18'],
      featured: false,
    },
    {
      slug: 'portfolio-os',
      name: 'Portfolio OS',
      tagline: 'This site: five miniature operating systems that hold one career.',
      context: 'Personal project',
      description: [
        'iOS, macOS, Windows 11, Android and a Linux terminal, each with its own navigation, windows, motion and system surfaces — built on one typed kernel and one data module.',
      ],
      highlights: [
        'One pure-TypeScript kernel for windows, routing, history and persistence',
        'A real shell engine over a virtual filesystem for the terminal',
        'Static, accessible and fast: every URL works without JavaScript',
      ],
      stack: ['Next.js', 'React', 'TypeScript', 'GSAP', 'three.js'],
      year: 2026,
      featured: false,
    },
  ],
  education: [
    {
      slug: 'uab',
      school: 'University of Alabama at Birmingham',
      shortName: 'UAB',
      degree: 'M.S. Computer Science',
      start: '2024-01',
      end: '2025-12',
      notes: [
        'Database Systems',
        'Software Design & Integration',
        'Machine Learning',
        'Deep Learning',
        'Computer Vision',
        'Network, Computer & Cloud Security',
      ],
    },
    {
      slug: 'jntuh',
      school: 'Jawaharlal Nehru Technological University Hyderabad',
      shortName: 'JNTUH',
      degree: 'B.Tech Computer Science',
      start: '2019',
      end: '2023',
      notes: [
        'Data Structures & Algorithms',
        'Operating Systems',
        'Distributed Systems',
        'Compiler Design',
        'Cryptography & Network Security',
      ],
    },
  ],
  credentials: [
    { name: 'AWS Cloud Architecting', issuer: 'Amazon Web Services' },
    { name: 'AWS Machine Learning Foundations', issuer: 'Amazon Web Services' },
  ],
  skills: [
    {
      id: 'languages',
      label: 'Languages',
      items: [
        { name: 'Go' },
        { name: 'Java 17' },
        { name: 'Python' },
        { name: 'SQL' },
        { name: 'TypeScript' },
        { name: 'JavaScript' },
        { name: 'C' },
        { name: 'C++' },
        { name: 'Bash' },
      ],
    },
    {
      id: 'backend',
      label: 'Backend & microservices',
      items: [
        { name: 'Spring Boot' },
        { name: 'Spring Data JPA' },
        { name: 'Hibernate' },
        { name: 'FastAPI' },
        { name: 'Flask' },
        { name: 'Node.js' },
        { name: 'SQLAlchemy' },
        { name: 'REST APIs' },
        { name: 'OpenAPI / Swagger' },
      ],
    },
    {
      id: 'identity',
      label: 'Identity & security',
      items: [
        { name: 'OAuth 2.1' },
        { name: 'OpenID Connect' },
        { name: 'PKCE' },
        { name: 'JWT (RS256 / JWKS)' },
        { name: 'Argon2id' },
        { name: 'RBAC' },
        { name: 'Microsoft Entra ID SSO' },
        { name: 'Rate limiting, CSRF, HSTS/CSP' },
      ],
    },
    {
      id: 'data',
      label: 'Data & storage',
      items: [
        { name: 'PostgreSQL' },
        { name: 'MySQL' },
        { name: 'Redis' },
        { name: 'Elasticsearch' },
        { name: 'Celery' },
        { name: 'Query plans & indexing' },
      ],
    },
    {
      id: 'frontend',
      label: 'Frontend',
      items: [{ name: 'React' }, { name: 'Redux' }, { name: 'Vite' }, { name: 'Tailwind CSS' }],
    },
    {
      id: 'platform',
      label: 'Cloud, tooling & CI/CD',
      items: [
        { name: 'Docker' },
        { name: 'Nginx' },
        { name: 'Linux' },
        { name: 'GitHub Actions' },
        { name: 'AWS' },
        { name: 'Azure' },
        { name: 'Maven' },
        { name: 'JUnit 5' },
        { name: 'Mockito' },
        { name: 'Postman' },
        { name: 'Selenium' },
      ],
    },
  ],
  resume: {
    file: '/resume/jaswanth-narravula-resume.pdf',
    downloadName: 'Jaswanth-Resume.pdf',
    updated: '2026-09-23',
  },
  provenance: {
    sources: [
      { label: 'GitHub profile', url: 'https://github.com/Jaswanthnarravula' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/jaswanth-narravula/' },
    ],
    retrieved: '2026-09-21',
    metricsReported: true,
  },
} as const satisfies Portfolio;

export type PortfolioData = typeof portfolio;
