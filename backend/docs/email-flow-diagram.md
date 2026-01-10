# Email Flow Diagrams (Mermaid)

> These diagrams can be viewed in GitHub, VS Code (with Mermaid extension), or [Mermaid Live Editor](https://mermaid.live)

---

## 🔄 Overall Email System Flow

```mermaid
flowchart TB
    subgraph Triggers["📥 TRIGGERS"]
        UA[👤 User Action]
        CRON[⏰ Scheduled Cron]
        SYS[🔧 System Event]
    end

    subgraph UserActions["User Actions"]
        CREATE[Create Employee]
        APPROVE[Approve/Reject]
        PWD[Password Reset]
        REG[Regularize Attendance]
    end

    subgraph CronJobs["Daily Cron Jobs (8 AM)"]
        CELEB[🎂 Celebrations]
        EXPIRY[⚠️ Expiry Checks]
        REMIND[📝 Reminders]
    end

    subgraph SystemEvents["System Events"]
        FAIL[❌ Job Failure]
    end

    UA --> UserActions
    CRON --> CronJobs
    SYS --> SystemEvents

    CREATE --> E1[📧 Welcome Email]
    APPROVE --> E2[📧 Approval/Rejection]
    PWD --> E3[📧 Password Reset]
    REG --> E4[📧 Regularization]

    CELEB --> E5[📧 Birthday/Anniversary]
    EXPIRY --> E6[📧 Expiry Alerts]
    REMIND --> E7[📧 Pending Reminders]

    FAIL --> E8[📧 Cron Failure Alert]

    style Triggers fill:#e0e7ff,stroke:#4338ca
    style UserActions fill:#dcfce7,stroke:#16a34a
    style CronJobs fill:#fef3c7,stroke:#f59e0b
    style SystemEvents fill:#fed7d7,stroke:#c53030
```

---

## ✅ Approval Workflow

```mermaid
flowchart LR
    subgraph Employee["👤 Employee"]
        REQ[Submit Request]
    end

    subgraph Types["Request Types"]
        LEAVE[🏖️ Leave]
        EXP[💰 Expense]
        FUEL[⛽ Fuel Expense]
        ATT[📊 Attendance]
    end

    subgraph Manager["👨‍💼 Manager"]
        REVIEW[Review Request]
        APPR[✅ Approve]
        REJ[❌ Reject]
    end

    subgraph Emails["📧 Notifications"]
        APPR_EMAIL[Approval Email]
        REJ_EMAIL[Rejection Email]
    end

    REQ --> Types
    Types --> REVIEW
    REVIEW --> APPR
    REVIEW --> REJ
    APPR --> APPR_EMAIL
    REJ --> REJ_EMAIL

    APPR_EMAIL --> |to Employee| END1[📬]
    REJ_EMAIL --> |to Employee| END2[📬]

    style Employee fill:#e0e7ff,stroke:#4338ca
    style Manager fill:#fef3c7,stroke:#f59e0b
    style Emails fill:#dcfce7,stroke:#16a34a
```

---

## ⏰ Daily Cron Schedule

```mermaid
gantt
    title Daily Email Cron Jobs (8:00 AM)
    dateFormat HH:mm
    axisFormat %H:%M

    section Celebrations
    Birthday Check      :08:00, 5m
    Anniversary Check   :08:05, 5m

    section Expiry Checks
    Card Expiry         :08:10, 5m
    Vehicle Docs        :08:15, 5m
    Vehicle Service     :08:20, 5m
    Asset Calibration   :08:25, 5m
    Asset Warranty      :08:30, 5m

    section Reminders
    Expense Reminder    :08:35, 5m
    Leave Reminder      :08:40, 5m
    Attendance Reminder :08:45, 5m
```

---

## ⚠️ Expiry Alert Categories

```mermaid
flowchart TB
    subgraph DailyCron["⏰ Daily Cron (8 AM)"]
        CHECK[Check All Expiries]
    end

    CHECK --> CARDS[💳 Cards]
    CHECK --> VDOCS[📄 Vehicle Docs]
    CHECK --> VSERV[🔧 Vehicle Service]
    CHECK --> ACAL[🔬 Asset Calibration]
    CHECK --> AWAR[🛡️ Asset Warranty]

    subgraph Status["Status Classification"]
        EXP[🚫 EXPIRED]
        SOON[⚠️ EXPIRING SOON]
    end

    CARDS --> Status
    VDOCS --> Status
    VSERV --> Status
    ACAL --> Status
    AWAR --> Status

    Status --> EMAIL[📧 Consolidated Alert Email]
    EMAIL --> ADMIN[🏢 HR/Admin]

    style DailyCron fill:#e0e7ff,stroke:#4338ca
    style Status fill:#fef3c7,stroke:#f59e0b
```

---

## 📝 Manager Reminder Flow

```mermaid
flowchart TB
    subgraph Cron["⏰ Daily Cron"]
        CHECK[Check Pending Items]
    end

    CHECK --> PEXP[💰 Pending Expenses]
    CHECK --> PLEAVE[🏖️ Pending Leaves]
    CHECK --> PATT[📊 Pending Attendance]

    subgraph Categorize["Categorization"]
        URG[🚨 Urgent<br/>5+ days pending]
        REG[📋 Regular<br/>Recent pending]
    end

    PEXP --> Categorize
    PLEAVE --> Categorize
    PATT --> Categorize

    Categorize --> GROUP[Group by Manager]
    GROUP --> EMAIL[📧 Reminder Email]
    EMAIL --> MGR[👨‍💼 Each Manager]

    subgraph AutoApproval["⚠️ Auto-Approval"]
        AA[Leaves & Attendance<br/>Auto-approved on 1st<br/>of each month]
    end

    PLEAVE -.-> AutoApproval
    PATT -.-> AutoApproval

    style Cron fill:#e0e7ff,stroke:#4338ca
    style URG fill:#fed7d7,stroke:#c53030
    style AutoApproval fill:#fef3c7,stroke:#f59e0b
```

---

## 🎉 Celebration Email Flow

```mermaid
flowchart LR
    subgraph Cron["⏰ Daily 8 AM"]
        CHECK[Check Today's Date]
    end

    CHECK --> BDAY{Birthday<br/>Match?}
    CHECK --> ANNIV{Work Anniversary<br/>Match?}

    BDAY -->|Yes| BDAY_EMAIL[🎂 Birthday Email]
    ANNIV -->|Yes| ANNIV_CHECK{Milestone Year?<br/>5,10,15,20...}

    ANNIV_CHECK -->|Yes| MILESTONE[🏆 Milestone Email]
    ANNIV_CHECK -->|No| REG_ANNIV[🎉 Anniversary Email]

    BDAY_EMAIL --> EMP[👤 Employee]
    MILESTONE --> EMP
    REG_ANNIV --> EMP

    style Cron fill:#e0e7ff,stroke:#4338ca
    style MILESTONE fill:#fef3c7,stroke:#f59e0b
```

---

## 📧 Email Template Mapping

```mermaid
mindmap
    root((📧 Email<br/>Templates))
        Onboarding
            welcomeEmployee.hbs
        Approvals
            attendanceApproval.hbs
            expenseApproval.hbs
            leaveApproval.hbs
        Regularization
            attendanceRegularization.hbs
        Celebrations
            birthdayWish.hbs
            workAnniversary.hbs
        Authentication
            forgetPassword.hbs
        Expiry Alerts
            cardExpiry.hbs
            vehicleDocumentExpiry.hbs
            vehicleServiceDue.hbs
            assetCalibrationExpiry.hbs
            assetWarrantyExpiry.hbs
        Reminders
            pendingExpenseReminder.hbs
            leaveApprovalReminder.hbs
            attendanceApprovalReminder.hbs
            fyLeaveConfigReminder.hbs
        System
            cronFailure.hbs
```

---

## 🔄 Complete Email Lifecycle

```mermaid
sequenceDiagram
    participant U as 👤 User/System
    participant S as 🖥️ Backend Service
    participant E as 📧 Email Service
    participant M as 📬 Mailgun/SMTP
    participant R as 📥 Recipient

    U->>S: Trigger Event
    S->>S: Generate Email Data
    S->>E: Send Email Request
    E->>E: Load HBS Template
    E->>E: Compile with Data
    E->>M: Send via Transport
    M->>R: Deliver Email
    M-->>E: Delivery Status
    E-->>S: Log Communication
```

---

## 📊 Email Recipient Matrix

```mermaid
quadrantChart
    title Email Recipients by Trigger Type
    x-axis Manual Trigger --> Automated Trigger
    y-axis Individual --> Bulk

    Welcome Email: [0.1, 0.15]
    Approval Emails: [0.2, 0.2]
    Password Reset: [0.1, 0.1]
    Regularization: [0.15, 0.15]
    Birthday: [0.8, 0.1]
    Anniversary: [0.8, 0.15]
    Cron Failure: [0.9, 0.1]
    Card Expiry: [0.85, 0.7]
    Vehicle Alerts: [0.85, 0.75]
    Asset Alerts: [0.85, 0.8]
    Manager Reminders: [0.9, 0.6]
    FY Config: [0.75, 0.5]
```

---

_View these diagrams at [mermaid.live](https://mermaid.live) or in VS Code with Mermaid extension_
