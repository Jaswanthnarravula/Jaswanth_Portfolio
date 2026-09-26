import type { Portfolio } from './schema';

/**
 * Every career fact lives here and nowhere else (shared/02, north-star B9).
 *
 * Sources: the owner's published résumé (`Resume.pdf`, 2026-09-23) — roles, dates, locations, bullets — their
 * public GitHub profile README (github.com/Jaswanthnarravula, retrieved 2026-09-21) for detail the résumé omits, and
 * the owner's content questionnaire (2026-09-25; copy approved as "Portfolio Copy Review", shared/23). Work
 * authorization, GPA and recommendations are withheld by the owner and have no field.
 * Where the résumé and older sources disagree, the résumé wins. Facts neither publishes stay `null` with `placeholder: true`.
 * UI code must read this module through `data/selectors` only (lint-enforced).
 */
export const portfolio = {
  person: {
    name: 'Jaswanth Narravula',
    givenName: 'Jaswanth',
    headline: 'Backend Software Engineer — Java/Spring Boot and Go · distributed systems and identity',
    role: 'Software Engineer',
    location: 'Sugar Land, Texas',
    summary: [
      'Backend software engineer with 3+ years building systems where correctness and security matter — identity platforms, concurrent transaction workflows and the data layer beneath them. I work mainly in Java/Spring Boot and Go.',
      'At Xclusive Trading Inc. I own our OAuth 2.1 / OpenID Connect identity platform end to end. I designed and built it in Go, and it now signs in about 3,000 people across roughly 12 internal applications. On the same eight-person team I helped split a tightly coupled platform into six independently deployable services, and cut a daily 50-million-row report from 4 min 20 s to 1 min 45 s.',
      'At IBM, working for DBS Bank, I was the primary implementer of the eligibility and approval-workflow services on a corporate-loan platform. I made concurrent approvals safe with a state-driven workflow and optimistic locking, and cut average API latency from about 420 ms to 290 ms. I hold an M.S. in Computer Science from the University of Alabama at Birmingham.',
      'I’m looking for teams where security, concurrency, data performance and reliability are first-class concerns — high-scale APIs, distributed services, identity platforms or data-intensive systems.',
    ],
    openTo: 'Open to backend software engineering roles.',
    glance: {
      targetRoles: ['Backend Software Engineer', 'Software Engineer II'],
      experience: '3+ years · IBM (DBS Bank), Xclusive Trading Inc.',
      coreStack: ['Java 17', 'Spring Boot', 'Go', 'Python / FastAPI', 'PostgreSQL', 'MySQL', 'Redis'],
      strengths: [
        'Identity & security (OAuth 2.1 / OIDC)',
        'Concurrency & transactions',
        'Query performance',
        'Reliability',
      ],
      workModes: ['Sugar Land, TX', 'Houston on-site or hybrid', 'Remote (US)', 'Open to relocate'],
      availability: 'Two weeks’ notice',
    },
    now: {
      text: 'Building a clean-room OAuth/OIDC provider in Go — open source, no company code. Preparing for AWS Solutions Architect – Associate (target March 2027). Going deeper on reliability, observability and failure-aware backend design.',
      updated: '2026-09',
    },
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
      {
        kind: 'instagram',
        label: 'Instagram',
        url: 'https://www.instagram.com/jaswanth_narravula/',
        handle: '@jaswanth_narravula',
      },
    ],
  },
  experience: [
    {
      slug: 'xclusive-trading',
      company: 'Xclusive Trading Inc.',
      role: 'Software Engineer',
      start: '2025-06',
      end: 'present',
      location: 'Sugar Land, TX',
      summary:
        'Owns the identity platform, and works on the service boundaries and data layer that internal applications depend on.',
      scope:
        'Eight-person engineering team, reporting to the engineering lead. Primary end-to-end owner of the identity and authentication platform: architecture, implementation, security posture and reliability. Other engineers integrate their applications with it.',
      highlights: [
        'Designed and built an OAuth 2.1 / OpenID Connect identity provider in Go — authorization code with PKCE, OIDC discovery, RS256-signed JWTs with JWKS key rotation, refresh-token rotation with reuse detection, Argon2id and RBAC. It signs in ~3,000 users across ~12 internal applications (1,200–1,800 interactive sign-ins per weekday, plus service-to-service token exchanges).',
        'Hardened authentication with per-IP rate limiting, CSRF protection, HSTS/CSP, audit logging, impersonation-safe sessions and geo restrictions; integrated Microsoft Entra ID over OIDC for workforce apps.',
        'Cut a daily 50M+-row sales and inventory report from 4 min 20 s to 1 min 45 s (~60%). EXPLAIN ANALYZE showed repeated scans and expensive aggregations; composite indexes, restructured queries and a denormalized daily summary table fixed them.',
        'Held REST endpoints at 180–195 ms p95 under typical weekday load (35–50 req/s, 150–200 concurrent sessions, measured in Azure Application Insights) through connection-pool tuning, query optimization and transient-failure retries.',
        'Helped split a tightly coupled platform into 6 services along domain lines — identity, workforce workflows, reporting, ETL, notifications and shared business APIs — so a reporting slowdown can no longer degrade sign-in.',
        'After a partial ETL failure risked duplicate records, traced it through job logs and database state, repaired the batch, and redesigned the pipeline around deterministic job IDs, idempotent writes, replay-safe stages, checkpoints and exponential backoff. Failed batches now resume or rerun safely without manual cleanup.',
        'Sped up React/TypeScript interfaces with code splitting, lazy loading, request deduplication, TTL caching, cancellation and memoization; delivered WebSocket chat and notifications; standardized CI/CD on GitHub Actions.',
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
        'GitHub Actions',
      ],
    },
    {
      slug: 'ibm',
      company: 'IBM',
      client: 'DBS Bank',
      role: 'Software Engineer',
      start: '2022-05',
      end: '2023-12',
      location: 'Hyderabad, India',
      summary: 'Built the eligibility and approval-workflow services of a corporate-loan platform for DBS Bank.',
      scope:
        'Seven-person IBM squad inside a ~35-person DBS Bank loan-platform program, reporting through the IBM technical lead. Primary implementer of the eligibility and approval-workflow services: transaction boundaries, workflow-state correctness, concurrency control, database performance, tests and API contracts. The platform handled roughly 250–400 new applications or approval updates per business day for several hundred operations staff across regional teams.',
      highlights: [
        'Built and maintained 10+ production REST APIs in Java 17, Spring Boot, Spring Data JPA and Hibernate covering loan intake, eligibility validation, business rules and multi-stage approvals.',
        'Made concurrent approvals safe: one state-driven workflow owns every valid transition, each task runs in its own Spring transaction, and JPA @Version optimistic locking rejects stale writes. Integration tests and load runs fired competing approvals at one record — exactly one transition commits and the other fails safely and can retry.',
        'Cut average response time on the busiest intake, eligibility and approval endpoints from ~420 ms to ~290 ms (~30%), keeping p95 under ~650 ms in JMeter runs at 100 concurrent users and 60–80 req/s. The fixes were slow queries and missing indexes found in execution plans, corrected JPA/Hibernate access patterns, and Redis caching for hot reads.',
        'Covered services with JUnit 5 and Mockito, validated REST contracts with OpenAPI and Postman, and kept builds repeatable with Maven.',
        'Given added responsibility for concurrency-sensitive workflow logic, performance tuning and production API changes after reliable delivery on the first loan-processing services.',
      ],
      stack: ['Java 17', 'Spring Boot', 'JPA / Hibernate', 'MySQL', 'Redis', 'JUnit 5', 'Mockito', 'Maven'],
    },
    {
      slug: 'aicte',
      company: 'All India Council for Technical Education (AICTE)',
      role: 'Technical Intern',
      start: '2021-10',
      end: '2022-03',
      location: 'Remote',
      summary: 'Technical internships in AWS cloud architecture and applied machine learning.',
      highlights: [
        'Built AWS lab environments with EC2, S3, VPC, RDS, Lambda, CloudWatch and IAM, applying AWS Well-Architected principles across security, scalability, availability, monitoring and cost.',
        'Completed applied ML labs covering data preparation, feature engineering, model training and evaluation, forecasting, computer vision and NLP; trained and deployed models with Amazon SageMaker.',
      ],
      stack: ['AWS EC2', 'S3', 'VPC', 'RDS', 'Lambda', 'CloudWatch', 'IAM', 'Amazon SageMaker', 'Python'],
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
        'It runs beside Microsoft Entra ID and is the central sign-in for about 3,000 people across roughly 12 internal applications and services. I own it end to end.',
      ],
      highlights: [
        'Authorization code flow with PKCE and refresh-token rotation with reuse detection',
        'RS256-signed JWTs with JWKS key rotation — no logouts during rotation',
        'Argon2id credential hashing and 4-tier RBAC',
        'Admin session management and 15+ client integration examples',
      ],
      caseStudy: {
        problem: [
          'Microsoft Entra ID already handled workforce sign-in and Microsoft-integrated apps. But about 12 internal applications serving 3,000+ users each needed things Entra didn’t give us cheaply: one OAuth/OIDC contract, custom roles and claims, service-to-service identities, and control over refresh-token behaviour and security policy.',
          'Each app was carrying its own copy of security-sensitive code.',
        ],
        role: 'Primary end-to-end owner — architecture, implementation, security posture and reliability.',
        decisions: [
          {
            title: 'Run beside Entra ID, not instead of it.',
            detail:
              'Entra keeps workforce and Microsoft apps; each application picks the platform that fits its identity needs.',
            rejected:
              'Moving everything to a commercial IdP — higher-tier licensing, and authorization logic would still be scattered across apps.',
          },
          {
            title: 'Implement the standards, and keep the scope narrow.',
            detail:
              'Authorization code + PKCE, OIDC discovery, RS256 JWTs, JWKS — nothing home-made on the wire, so any standard client library works.',
          },
          {
            title: 'Rotate signing keys with an overlap window.',
            detail:
              'The new public key is published before it signs anything; the old one stays until every token it signed has expired. No one is logged out.',
          },
          {
            title: 'Refresh tokens are single-use.',
            detail:
              'Reusing an old one revokes the whole token family, writes an audit event and forces a fresh sign-in.',
          },
        ],
        results: [
          { value: '~3,000', label: 'users' },
          { value: '~12', label: 'apps and services' },
          { value: '1,200–1,800', label: 'sign-ins per weekday' },
          { value: 'No logouts', label: 'during key rotation, by design' },
        ],
        flow: [
          { label: 'Internal apps', detail: '~12 apps and services, one OAuth/OIDC contract' },
          { label: 'Authorize + PKCE', detail: 'Authorization code flow, OIDC discovery' },
          { label: 'Go identity provider', detail: 'Chi · PostgreSQL · Argon2id · 4-tier RBAC' },
          { label: 'RS256 JWT', detail: 'Single-use refresh tokens with reuse detection' },
          { label: 'JWKS', detail: 'Overlapping key generations, verified by kid' },
        ],
      },
      deepDives: [
        {
          slug: 'why-we-built-our-own-idp',
          title: 'Why we built our own identity provider — and kept Entra ID',
          summary: 'The case for a narrow, standards-based identity layer that runs beside Entra ID.',
          blocks: [
            {
              kind: 'p',
              text: 'Microsoft Entra ID handles workforce sign-in and our Microsoft-integrated tools. It’s the right tool for that job, and we kept it.',
            },
            {
              kind: 'p',
              text: 'The problem was everything else. About twelve internal applications, used by more than 3,000 people, each needed the same things: one OAuth/OIDC contract, roles and claims that match our business, identities for services that call other services, and tight control over token lifetime and refresh. Without a shared layer, every application carried its own copy of that security-sensitive code.',
            },
            {
              kind: 'p',
              text: 'Moving the whole footprint to a commercial identity platform meant higher-tier licensing, and it still left business authorization logic spread across every application. So I built a deliberately scoped identity provider in Go that runs beside Entra ID. It implements the standards — authorization code with PKCE, OIDC discovery, RS256-signed JWTs, refresh-token rotation — rather than inventing anything, so any standard client library can use it.',
            },
            {
              kind: 'p',
              text: 'Each application now picks the platform that fits its identity needs. Token security lives in one codebase and one audit log, and each application can focus on its own domain logic.',
            },
            {
              kind: 'p',
              text: 'The work took more than making login succeed. It meant reasoning about standards, token security, signing-key rotation, application integration, authorization boundaries, failure modes and long-term operability.',
            },
          ],
        },
        {
          slug: 'rotating-signing-keys',
          title: 'Rotating signing keys without logging anyone out',
          summary: 'Overlapping JWKS key generations, and single-use refresh tokens with reuse detection.',
          blocks: [
            {
              kind: 'p',
              text: 'Every access token our identity provider issues is a JWT signed with an RS256 private key. Applications check it with the matching public key, published at a JWKS endpoint. Keys have to rotate — but if a key vanishes while tokens it signed are still alive, every one of those users is suddenly signed out.',
            },
            { kind: 'p', text: 'So rotation happens in overlapping steps:' },
            {
              kind: 'steps',
              items: [
                'Publish the new public key in the JWKS before it signs anything, so every client can fetch it early.',
                'Switch signing to the new key. New tokens carry its key ID (kid) in the header.',
                'Keep the old public key published until every access token it signed could have expired.',
                'Only then retire it.',
              ],
            },
            { kind: 'p', text: 'During the overlap, clients verify both generations by kid, and no session breaks.' },
            {
              kind: 'p',
              text: 'Refresh tokens get a stricter rule. Every refresh issues a new refresh token and invalidates the old one. If an old one is ever presented again, someone has a copy they shouldn’t — so the provider revokes the whole token family, records an audit event and asks the user to sign in again. Whoever uses a stolen token second, the thief or the real user, triggers the revocation.',
            },
          ],
        },
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
        'A React + Vite frontend over 6 independent Python services with isolated failure boundaries — identity, workforce workflows, reporting, ETL, notifications and shared business APIs.',
        'Roles propagate as JWTs from the internal SSO provider; ETL pipelines are replayable, so a retried or partially failed batch reprocesses cleanly instead of writing duplicates.',
      ],
      highlights: [
        '6 independently deployable services with isolated failure domains',
        'JWT role propagation from the internal SSO provider',
        'Idempotent, replay-safe ETL with checkpoints and exponential backoff',
        'Daily 50M+-row report cut from 4 min 20 s to 1 min 45 s',
      ],
      caseStudy: {
        problem: [
          'One tightly coupled service held identity, workforce workflows, reporting, ETL, notifications and shared business APIs — they deployed together and failed together.',
          'A heavy report or a stuck ETL job could slow everything, sign-in included.',
        ],
        role: 'Part of the team that split the platform. I redesigned the ETL recovery and did the reporting performance work.',
        decisions: [
          {
            title: 'Split by domain, not by technical layer.',
            detail: 'Six services chosen by data ownership, independent scaling, deploy cadence and failure isolation.',
          },
          {
            title: 'Make every ETL stage safe to re-run.',
            detail:
              'Deterministic job IDs, idempotent writes, checkpoints and exponential backoff — after a partial failure nearly created duplicate records.',
          },
          {
            title: 'Move aggregation out of the request path.',
            detail: 'A denormalized daily summary table plus composite indexes on the main filter and join columns.',
          },
        ],
        results: [
          { value: '6', label: 'independently deployable services' },
          { value: '4:20 → 1:45', label: 'daily report, 50M+ rows' },
          { value: '180–195 ms', label: 'p95 at 35–50 req/s' },
          { value: 'Rerun-safe', label: 'failed batches, no manual clean-up' },
        ],
        flow: [
          { label: 'React + Vite', detail: 'The sales frontend' },
          { label: 'SSO roles', detail: 'JWT roles from the internal SSO provider' },
          { label: '6 Python services', detail: 'Split by domain, isolated failure boundaries' },
          { label: 'Replayable ETL', detail: 'Deterministic job IDs, checkpoints, backoff' },
          { label: 'PostgreSQL', detail: 'Daily summary table + composite indexes' },
        ],
      },
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
        'An internal production system used by management and operations teams.',
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
      context: 'Solo UAB project',
      description: [
        'I designed the data model, the ingestion workflow, the comparison API and the reporting interface.',
        'Scrapy spiders feed Celery tasks over Redis with retries, so an unreliable retailer never stalls the pipeline. Results persist in PostgreSQL; Elasticsearch handles fuzzy search and cross-retailer ranking, price-history analytics sit on top, and Redis TTL caching cuts repeated PostgreSQL reads. The whole stack ships as Docker Compose.',
      ],
      highlights: [
        'Scrapy/Celery/Redis ingestion with retries and failure handling',
        'Elasticsearch fuzzy search and cross-retailer ranking',
        'Redis TTL caching in front of PostgreSQL',
        'Price-history analytics',
      ],
      stack: ['FastAPI', 'Scrapy', 'Celery', 'Redis', 'Elasticsearch', 'PostgreSQL', 'Docker Compose'],
      featured: false,
    },
    {
      slug: 'loan-processing',
      name: 'Corporate Loan Processing Platform',
      tagline: 'Production REST APIs for corporate loan intake and approvals.',
      context: 'IBM · DBS Bank',
      description: [
        '10+ production REST APIs automating loan intake, eligibility validation, business rules and multi-stage approvals — roughly 250–400 new applications or approval updates per business day for several hundred operations staff.',
        'Built around a state-driven workflow engine with optimistic locking and thread-safe service components, so concurrent approvals cannot land in invalid states.',
        'Execution-plan analysis, MySQL index and JPA/Hibernate access-pattern tuning plus Redis caching cut average API latency from ~420 ms to ~290 ms under concurrent load.',
      ],
      highlights: [
        '10+ production REST APIs',
        'State-driven workflow engine with optimistic locking',
        'Proven under contention: exactly one competing approval commits',
        'Average latency ~420 ms → ~290 ms; p95 under ~650 ms at 100 concurrent users',
        'JUnit 5 + Mockito tests; contracts validated with OpenAPI and Postman',
      ],
      caseStudy: {
        problem: [
          'Two approvers could act on the same loan application at nearly the same moment, risking lost updates, duplicate transitions or an application advancing from stale state.',
          'Busy endpoints were also slow under concurrent load.',
        ],
        role: 'Primary implementer of the eligibility and approval-workflow services in a seven-person squad.',
        decisions: [
          {
            title: 'One place defines every valid transition.',
            detail: 'A state-driven workflow, so no endpoint can move an application somewhere it isn’t allowed to go.',
          },
          {
            title: 'Optimistic locking, one transaction per task.',
            detail: 'JPA @Version rejects stale writes instead of letting them overwrite.',
          },
          {
            title: 'Prove it under contention.',
            detail: 'Integration tests and load runs fired competing approvals at a single record.',
          },
          {
            title: 'Fix latency where the execution plans pointed.',
            detail: 'Execution plans, indexes, ORM access patterns, then Redis for hot reads.',
          },
        ],
        results: [
          { value: '420 → 290 ms', label: 'average response' },
          { value: '< 650 ms', label: 'p95 at 100 concurrent users' },
          { value: '250–400', label: 'applications / updates per day' },
          { value: '10+', label: 'production APIs' },
        ],
        flow: [
          { label: 'REST APIs', detail: '10+ endpoints: intake, eligibility, approvals' },
          { label: 'Workflow engine', detail: 'One place defines every valid transition' },
          { label: 'Optimistic locking', detail: 'JPA @Version rejects stale writes' },
          { label: 'Redis', detail: 'Hot reads cached' },
          { label: 'MySQL', detail: 'Indexes tuned from execution plans' },
        ],
      },
      deepDives: [
        {
          slug: 'race-conditions-in-loan-approvals',
          title: 'Preventing race conditions in loan approvals',
          summary: 'A state-driven workflow, one transaction per task and optimistic locking, proven under contention.',
          blocks: [
            {
              kind: 'p',
              text: 'At IBM I worked on DBS Bank’s corporate-loan platform: roughly 250–400 new applications or approval updates a day, handled by several hundred operations staff. Loans move through multi-stage approvals, and sometimes two approvers act on the same application at nearly the same moment.',
            },
            {
              kind: 'p',
              text: 'Without protection, that causes three kinds of damage: a lost update, where one approver’s change silently overwrites the other’s; a duplicate transition, where the application advances twice; or a move based on stale state, approving something that has already changed underneath you.',
            },
            { kind: 'p', text: 'The fix had three parts:' },
            {
              kind: 'steps',
              items: [
                'One place defines what can happen. A state-driven workflow holds every valid transition, so no endpoint can move an application somewhere it isn’t allowed to go.',
                'One transaction per task. Each concurrent task runs in its own Spring transaction.',
                'Stale writes are rejected. JPA @Version optimistic locking stamps each row with a version; a write based on an old version fails instead of overwriting.',
              ],
            },
            {
              kind: 'p',
              text: 'To prove it, JUnit integration tests and concurrent load runs fired competing approvals at the same record. Every time, exactly one valid transition committed; the conflicting update failed safely and could be retried.',
            },
          ],
        },
      ],
      stack: ['Java 17', 'Spring Boot', 'JPA / Hibernate', 'MySQL', 'Redis', 'JUnit 5', 'Mockito', 'Maven'],
      featured: true,
      closedSource: true,
    },
    {
      slug: 'asl-gesture-recognition',
      name: 'ASL Gesture Recognition',
      tagline: 'A PyTorch pipeline for 24 static American Sign Language gestures.',
      context: 'Solo course project · UAB',
      description: [
        'Sign Language MNIST: 34,627 grayscale images across 24 static letters, where a random guess scores about 4.2%. Training from scratch reached 13.21% accuracy (macro-F1 0.081); transfer learning with ResNet-18 raised it to 43.36% (macro-F1 0.351) — roughly 10× chance.',
        'Accuracy was held back by low resolution, look-alike hand shapes, little variation in the data and the gap between ImageNet features and grayscale gestures. The value is the honest record — baseline, failed approaches, class imbalance and a measured gain — not a production claim.',
      ],
      highlights: [
        'Test accuracy 13.21% → 43.36% (about 10× chance)',
        'Macro-F1 0.081 → 0.351, tracked so class imbalance could not hide the gains',
        'Transfer learning with ResNet-18',
      ],
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
        'Distributed & Cloud-Native Software Design',
        'Machine Learning',
        'Deep Learning',
        'Computer Vision',
        'Network, Computer & Cloud Security',
        'Cyber Risk Management',
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
    {
      name: 'AWS Academy Cloud Architecting',
      issuer: 'AWS Academy',
      kind: 'course',
      status: 'earned',
      date: '2022-01',
      verifyUrl: 'https://www.linkedin.com/in/jaswanth-narravula/details/certifications/',
    },
    {
      name: 'AWS Academy Machine Learning Foundations',
      issuer: 'AWS Academy',
      kind: 'course',
      status: 'earned',
      date: '2022-05',
      verifyUrl: 'https://www.linkedin.com/in/jaswanth-narravula/details/certifications/',
    },
  ],
  skills: [
    {
      id: 'languages',
      label: 'Languages',
      items: [
        { name: 'Java 17', years: 1.5 },
        { name: 'Go', years: 1 },
        { name: 'Python', years: 1 },
        { name: 'SQL' },
        { name: 'TypeScript', years: 1, approx: true },
        { name: 'JavaScript' },
      ],
    },
    {
      id: 'backend',
      label: 'Backend & microservices',
      items: [
        { name: 'Spring Boot', years: 1.5 },
        { name: 'Spring Data JPA' },
        { name: 'Hibernate' },
        { name: 'FastAPI', years: 1 },
        { name: 'Flask' },
        { name: 'SQLAlchemy' },
        { name: 'REST APIs' },
        { name: 'Microservices' },
        { name: 'OpenAPI / Swagger' },
      ],
    },
    {
      id: 'distributed',
      label: 'Distributed systems',
      items: [
        { name: 'Concurrent programming' },
        { name: 'Java multithreading' },
        { name: 'Idempotency' },
        { name: 'Retry / backoff' },
        { name: 'Horizontal scaling' },
        { name: 'Fault tolerance' },
      ],
    },
    {
      id: 'identity',
      label: 'Identity & security',
      items: [
        { name: 'OAuth 2.1', years: 1 },
        { name: 'OpenID Connect', years: 1 },
        { name: 'PKCE' },
        { name: 'JWT (RS256 / JWKS)', years: 1 },
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
        { name: 'PostgreSQL', years: 1 },
        { name: 'MySQL', years: 1.5 },
        { name: 'Redis', years: 1.5 },
        { name: 'Elasticsearch' },
        { name: 'Celery' },
        { name: 'Transaction management' },
        { name: 'Query plans & indexing' },
        { name: 'Caching' },
      ],
    },
    {
      id: 'frontend',
      label: 'Frontend',
      items: [{ name: 'React', years: 1, approx: true }, { name: 'Vite' }],
    },
    {
      id: 'platform',
      label: 'Cloud, tooling & CI/CD',
      items: [
        { name: 'Docker', years: 1 },
        { name: 'Nginx' },
        { name: 'Linux' },
        { name: 'Git' },
        { name: 'GitHub Actions', years: 1 },
        { name: 'CI/CD' },
        { name: 'AWS' },
        { name: 'Azure' },
        { name: 'Maven' },
        { name: 'JUnit 5' },
        { name: 'Mockito' },
        { name: 'Postman' },
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
    retrieved: '2026-09-25',
    metricsReported: true,
  },
} as const satisfies Portfolio;

export type PortfolioData = typeof portfolio;
