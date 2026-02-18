# AWS RDS — Publicly accessible + Security Group 5432 (step by step)

Taki tumhara backend (laptop/PC se) AWS RDS se connect ho sake, ye do kaam karo:  
(1) RDS ko **Publicly accessible** banao, (2) Security Group mein **port 5432** allow karo.

---

## Part 1: RDS ko Publicly accessible karna

**Important (Aurora):** Agar tumhari DB **Aurora** (cluster) hai (e.g. **database-1**), to "Publicly accessible" **cluster** par nahi milta — ye **instance** par hota hai. Isliye **instance** par click karo, cluster par nahi.

### Step 1.1 — RDS Console kholna
1. Browser mein **https://console.aws.amazon.com** kholo.
2. Apne account se **login** karo.
3. Top search bar mein **RDS** likho.
4. **RDS** (Amazon RDS) par click karo.

### Step 1.2 — Instance select karna (Aurora ke liye zaroori)
5. Left side **Databases** par click karo.
6. List mein **do type** dikhenge:
   - **DB identifier** column mein **database-1** jaisa naam — ye **cluster** hai (Type: Aurora).
   - Uske neeche ya alag row mein **database-1-instance-1** (ya similar) — ye **instance** hai (Type: Writer / Reader).
7. **Instance** wali row par click karo (Writer wali), **cluster** wali par nahi.  
   — Instance par click karoge to detail page par **Publicly accessible** dikhega.

### Step 1.3 — Publicly accessible check karna
8. Instance ke detail page par neeche **Connectivity & security** section dhundho.
9. **Publicly accessible** row dekho:
   - Agar **Yes** hai → kuch mat karo, Part 2 (Security Group) par jao.
   - Agar **No** hai → Step 1.4 follow karo.

### Step 1.4 — Modify karke Publicly accessible = Yes karna
10. Page par **Modify** button (orange) par click karo.
11. **Connectivity** section tak scroll karo. Yahan **VPC security group** aur **Database port** ke neeche ya alag section mein **Publicly accessible** milna chahiye:
    - **Publicly accessible** = **Yes** select karo.
12. Agar yahan bhi nahi dikh raha to **Additional configuration** section neeche scroll karke dekho.
13. Neeche **Continue** → **Apply immediately** → **Modify DB instance** click karo.
14. Thodi der wait karo — status **Modifying** dikhega, phir **Available** ho jayega (1–5 min).

---

## Part 2: Security Group mein port 5432 allow karna

### Step 2.1 — Security Group par jana (Modify page par link nahi hota)
16. **tbidder-db-sg** ko RDS Modify page se open nahi kar sakte (wahan sirf tag dikhta hai). Isliye **EC2 → Security Groups** se jao:
17. Top search bar (AWS Console) mein **EC2** likho → **EC2** (Virtual Servers...) par click karo.
18. Left sidebar mein **Network & Security** → **Security Groups** par click karo.
19. List mein **tbidder-db-sg** dhundho (Name column) — us row par click karo (checkbox ya row select karo).
20. Neeche **Inbound rules** tab khula hoga.

### Step 2.2 — Inbound rules edit karna
18. **Inbound rules** tab par ho (default open hota hai).
19. **Edit inbound rules** button par click karo.

### Step 2.3 — Naya rule add karna (PostgreSQL 5432)
20. **Add rule** par click karo.
21. **Type:** dropdown se **PostgreSQL** select karo.  
    — Port **5432** automatically set ho jata hai.
22. **Source** dropdown:
    - **My IP** select karo — sirf tumhare current internet IP se connect hoga (recommended).  
    - Ya testing ke liye **Anywhere-IPv4** (0.0.0.0/0) — **sirf test ke liye**, production mein My IP use karo.
23. **Save rules** par click karo.

### Step 2.4 — Verify
24. **Inbound rules** list mein ek rule dikhna chahiye: Type **PostgreSQL**, Port **5432**, Source **My IP** ya **0.0.0.0/0**.

---

## Part 3: Backend se test karna

25. **backend/.env** mein PG_HOST, PG_PASSWORD sahi hona chahiye (pehle se set hai).
26. Terminal mein:
    ```bash
    cd c:\Users\Alexender The Great\Desktop\Tbidder_Project
    npm start
    ```
27. Log mein ye dikhna chahiye:
    - `[DB] Connecting to host: database-1.cluster-...`
    - `✅ DB: User, Ride, Message, ... tables synced.`
    - `🚀 [Tbidder] API listening on http://localhost:4000`

Agar ab bhi **ETIMEDOUT** aaye to:
- **IP change:** Security Group mein jo IP hai (e.g. 157.49.181.213) woh tumhare *current* internet IP se match hona chahiye. WiFi/network badla to IP badal jata hai. **Fix:** EC2 → Security Groups → tbidder-db-sg → Edit inbound rules → existing rule ka Source **My IP** se update karo (naya IP set ho jayega) ya **Add rule** se naya rule: Type PostgreSQL, Source **Anywhere-IPv4** (0.0.0.0/0) — sirf test ke liye.
- RDS status **Available** hai confirm karo (Modifying nahi).
- Office/cafe WiFi se **5432** block ho sakta hai — ghar ke WiFi ya mobile hotspot se try karo.
