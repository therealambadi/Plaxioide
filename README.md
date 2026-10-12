# PLAXIO

### The AI-Powered IDE for Industrial Automation

**Build smarter PLC programs. Write logic faster. Deploy across vendors.**

Plaxio is a modern desktop IDE for industrial automation, designed to bring AI-assisted PLC programming, graphical logic editing, vendor-neutral project workflows, live tag monitoring, and HMI simulation into one environment.

Built around IEC 61131-3 programming workflows, Plaxio helps control engineers design, validate, simulate, and manage PLC projects with less repetitive work and a more streamlined development experience.

[Download Plaxio](#installation) · [Documentation](#documentation) · [Request a Demo](#enterprise) · [Report an Issue](../../issues)

---

## ✨ Features

### 🤖 AI-Powered PLC Programming

Describe your control requirements in plain language and let Plaxio's AI agent generate PLC logic.

- Generate Ladder Diagram (LD) logic from natural-language instructions.
- Create motor start/stop sequences, interlocks, timers, and fault-reset logic.
- Generate multiple connected rungs with automatic wiring.
- Reduce repetitive programming and accelerate initial logic development.

### 🔄 Graphical and Code-Based Editing

Move between visual programming and source code without duplicating your work.

- Edit Function Block Diagram (FBD) logic on a graphical canvas.
- Switch between graphical and source views.
- Work with nodes, wires, connections, and tags in one project.
- Keep visual logic and its underlying representation synchronized.

### 🔌 Vendor-Neutral Project Workflows

Build projects with portability in mind instead of committing to a single PLC ecosystem.

Plaxio advertises support for the following vendor ecosystems and platforms:

| Vendor / Platform | Export format |
|---|---|
| Rockwell Automation | L5X |
| Siemens | SimaticML |
| Schneider Electric | XEF |
| CODESYS | Supported project workflows |
| PLCopen | PLCopen XML |
| Mitsubishi Electric | Platform compatibility advertised |
| Omron | Platform compatibility advertised |
| Beckhoff | Platform compatibility advertised |
| ABB | Platform compatibility advertised |

*Compatibility, import support, export support, and deployment capabilities may vary by vendor and project. Verify the supported operations for your target PLC before using a project on production hardware.*

### 📡 Live Tag Monitoring

Inspect and manage PLC tag values directly from the development environment.

- Monitor outputs, latches, timers, counters, and analog values.
- Inspect tag values while a program runs.
- Edit tag values and force bits where supported.
- Add tags during a monitoring session.
- Identify logic issues without constantly switching between tools.

> **Safety note:** Forcing PLC values can affect physical equipment. Use appropriate authorization, interlocks, risk assessments, and commissioning procedures before interacting with live systems.

### 🖥️ Built-In HMI and SCADA Simulation

Design and test operator interfaces without requiring physical PLC hardware for every development cycle.

- Build HMI screens inside the desktop environment.
- Connect interface widgets to simulated control logic.
- Visualize tanks, valves, pumps, gauges, and indicators.
- Test control sequences locally before commissioning.

### 🌿 Git-Based Version Control

Apply modern software-development workflows to industrial automation projects.

- Track changes to PLC programs.
- Create branches and commits.
- Review logic changes and differences.
- Merge updates and restore earlier versions.
- Maintain a more traceable engineering workflow.

### 🔒 Offline-First Development

Keep development workflows local where supported.

- Work without relying on a continuous internet connection.
- Use local AI models where configured.
- Reduce exposure of proprietary control logic to external services.
- Keep project development closer to the plant-floor environment.

*Offline operation depends on the configured AI model and enabled features. External integrations may require connectivity.*

---

## 🧰 Supported Programming Environments

Plaxio brings multiple industrial programming workflows into a single desktop application.

| Language / Editor | Purpose |
|---|---|
| Ladder Diagram (LD) | Relay-style control logic |
| Function Block Diagram (FBD) | Graphical function and signal-flow programming |
| Sequential Function Chart (SFC) | Sequential and state-oriented control workflows |
| Structured Text (ST) | Text-based PLC programming and logic representation |

Refer to the project documentation for the current implementation status of each editor, language, and vendor integration.

---

## 🚀 Installation

### Download a Release

1. Open the project's [Releases](../../releases) page.
2. Select a release compatible with your operating system.
3. Download the appropriate installation package.
4. Follow the installation instructions for that release.

**Note:** Replace the release link with the official distribution URL if downloads are hosted separately. If no public release is available yet, installation instructions should be added when the first build is published.

### System Requirements

Publish verified minimum requirements for:

- Operating system and supported versions
- CPU architecture
- RAM and available disk space
- GPU requirements, if applicable
- Supported local AI models and runtime dependencies
- PLC connectivity requirements, if applicable

---

## 🏁 Getting Started

A typical workflow in Plaxio looks like this:

1. **Create a project** — Set up your control application and define tags.
2. **Describe your logic** — Specify the desired machine or process behavior.
3. **Generate or edit logic** — Use AI-assisted generation or build the logic manually.
4. **Review connections** — Verify rungs, tags, interlocks, and execution conditions.
5. **Simulate the application** — Test the logic and associated HMI screens.
6. **Validate the project** — Check tags, addresses, data types, and vendor-specific constraints.
7. **Export the project** — Select a supported target format.
8. **Commission safely** — Validate the exported program using the target vendor's tools and approved commissioning procedures.

AI-generated control logic must always be reviewed and tested by a qualified controls engineer before deployment to physical equipment.

---

## 🏗️ Project Overview

Plaxio is intended to combine the major stages of PLC development in one environment:

```text
Control Requirements
        |
        v
AI-Assisted Logic Generation
        |
        v
PLC Editors (LD / FBD / SFC / ST)
        |
        v
Tag Management and Validation
        |
        v
HMI Simulation and Testing
        |
        v
Vendor-Specific Export
        |
        v
Engineering Review and Commissioning
```

This diagram describes the intended user workflow, not a verified internal software architecture.

---

## 🗺️ Roadmap

The following areas represent the product capabilities described for Plaxio. Adjust this section to reflect the actual public development plan.

- [x] AI-assisted Ladder Diagram generation
- [x] Graphical Function Block Diagram editing
- [x] Live tag monitoring
- [x] PLCopen XML export
- [x] Siemens SimaticML export
- [x] Git-based version control workflows
- [x] Built-in HMI simulation
- [ ] Expand and document vendor-specific compatibility
- [ ] Publish detailed installation and setup guides
- [ ] Add comprehensive examples and sample PLC projects
- [ ] Publish automated validation and testing guidance

*Checklist items should be verified against released builds before publication.*

---

## 📚 Documentation

Documentation should cover the following topics:

- Installation and configuration
- Creating and managing projects
- AI agent setup and supported prompts
- Ladder Diagram programming
- Function Block Diagram editing
- Tag management and monitoring
- HMI simulation
- Import and export formats
- Git workflows
- Troubleshooting and safety guidance

**Documentation:** Add the official documentation URL here.

---

## 🏢 Enterprise

Plaxio is designed for control engineering teams that need a consistent development environment across projects and PLC ecosystems.

Potential enterprise use cases include:

- Standardizing PLC development workflows
- Accelerating repetitive logic development
- Migrating supported legacy projects
- Improving project review and change tracking
- Testing control logic before commissioning
- Keeping proprietary engineering work local where supported

For enterprise inquiries, contact your Plaxio sales or engineering team.

**Demo:** Add the official demo-request URL here.

---

## 🤝 Contributing

Contributions are welcome when the repository and its licensing permit them.

Before submitting a contribution:

1. Check existing issues and discussions.
2. Describe the problem or proposed improvement.
3. Include reproducible steps for bug reports.
4. Add relevant tests and documentation.
5. Submit a pull request describing the change.

If the repository is not open for external contributions, replace this section with the appropriate issue-reporting and support policy.

---

## 🛡️ Security and Safety

Industrial automation software can interact with equipment that affects people, facilities, and production systems.

- Review all AI-generated logic before use.
- Test control sequences in a safe simulation or test environment.
- Verify exported programs using the target vendor's engineering tools.
- Apply appropriate safety-rated controls independently of ordinary PLC application logic.
- Never bypass machine safeguards or emergency-stop systems for convenience.
- Follow your organization's change-management and commissioning procedures.
- Report security vulnerabilities through the project's designated private disclosure channel.

Plaxio is an engineering tool and does not replace professional safety engineering, independent verification, or required regulatory compliance.

---

## 📄 License

The project's license has not been specified in the supplied product description.

Add the applicable license before distributing the source code. Until a license is published, do not assume that the repository is open source or that its contents may be redistributed.

---

## 🔗 Links

- **Website:** Add the official Plaxio URL
- **Downloads:** [Releases](../../releases)
- **Documentation:** Add the documentation URL
- **Issues:** [GitHub Issues](../../issues)
- **Community:** Add the official community URL

---

**PLAXIO — The desktop IDE for industrial automation.**

*One environment. Smarter PLC development. Vendor-neutral workflows.*
