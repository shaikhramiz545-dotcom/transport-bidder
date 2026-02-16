# AWS RDS – Endpoint, Region, Password kahan se milega?

Yeh sab **tumhare AWS account** mein hota hai. Code/backend mein koi password generate nahi karta; tum **AWS Console** se RDS banao ya pehle se bani instance use karo.

---

## 1. RDS Endpoint kahan milega?

- **AWS Console** kholo → **RDS** (search mein "RDS" likho).
- Left side: **Databases** par click karo.
- Jo PostgreSQL instance list mein dikhe, us par click karo.
- Detail page par **Connectivity & security** section mein:
  - **Endpoint** = yehi tumhara `PG_HOST` (e.g. `tbidder.abc123xy.ap-south-1.rds.amazonaws.com`).

Agar abhi koi RDS instance nahi hai, to pehle **Create database** se nayi PostgreSQL instance banao; create hone ke baad wahi page par **Endpoint** dikhega.

---

## 2. Region kahan milega?

- Same RDS page par **Region** top-right ya resource detail mein likha hota hai (e.g. **Mumbai** = `ap-south-1`, **N. Virginia** = `us-east-1`).
- **Endpoint** ke andar bhi region hota hai: `....ap-south-1.rds.amazonaws.com` → region `ap-south-1`.

Tumhe alag se "region" set karne ki zaroorat nahi; **Endpoint** full copy karke `PG_HOST` mein daalna kaafi hai.

---

## 3. Kaun sa password chahiye?

RDS ka **master password** chahiye — woh password jo **tumne khud** RDS instance **create karte waqt** set kiya tha.

- **Yaad hai:** Wahi password `backend/.env` mein `PG_PASSWORD=` ke saath daalo.
- **Bhool gaye:**  
  - RDS → apni instance → **Modify** (ya **Actions** → **Modify**).  
  - **Master password** section mein naya password set karo, save karo.  
  - RDS thodi der baad restart ho sakti hai; phir backend `.env` mein yehi naya password use karo.

**Important:** Yeh password AWS tumhe "generate" karke nahi deta; **tum hi** create/modify ke waqt set karte ho. Project/code mein koi naya password "banate" nahi — sirf tumhare `.env` mein wohi RDS master password likhna hota hai.

---

## 4. Agar main (code/script) password "banata" to use/benefit?

- **Backend/code** sirf **use** karta hai jo tum `.env` mein daalte ho.  
- **Naya strong password "banane"** ka matlab hota hai: tum apna **khud ka** strong password soch kar RDS Modify se set karo, aur wahi `.env` mein daal do.  
- **Benefit:** Strong, unique password → RDS zyada secure.  
- **Ye kaam tum AWS Console se karte ho;** main sirf yeh bata sakta hoon ke `.env` mein `PG_PASSWORD=` mein kya daalna hai (jo bhi tumne RDS ke liye set kiya).

---

## 5. Summary – step by step

| Cheez      | Kahan milegi / kaise set karni hai |
|------------|-------------------------------------|
| **Endpoint** | AWS Console → RDS → Databases → apni instance → **Endpoint** (copy karke `PG_HOST` mein daalo). |
| **Region**   | Endpoint ke andar ya RDS page par (e.g. `ap-south-1`). Alag set karne ki zaroorat nahi. |
| **Password**| RDS create/Modify ke waqt **tumne jo master password diya** — wahi `PG_PASSWORD` mein daalo. Bhool gaye to RDS Modify se naya set karo. |

`backend/.env` example:

```env
PG_HOST=tbidder.xxxxx.ap-south-1.rds.amazonaws.com
PG_PORT=5432
PG_DATABASE=tbidder
PG_USER=postgres
PG_PASSWORD=jo_password_tumne_RDS_ke_liye_set_kiya
PG_SSL=true
```

Iske baad backend restart karo; DB connection AWS RDS se ho jayega.

---

## 6. Troubleshooting

### "Port 4000 is already in use"

Koi purana server (root `server.js` ya pehla backend) abhi bhi chal raha hai. Use band karo:

**Windows (PowerShell):**
```powershell
# Dekho kaun process 4000 use kar raha hai
netstat -ano | findstr :4000

# Last column PID hai; usko kill karo (PID ki jagah actual number daalo)
taskkill /PID <PID> /F
```

Ya **alag port** use karo: `backend/.env` mein `PORT=4001` daal do.

---

### "ETIMEDOUT" / Database connection timeout

Matlab tumhara PC **RDS tak pahunch nahi pa raha**. Do cheezein check karo:

1. **RDS "Publicly accessible"**
   - AWS Console → RDS → Databases → apni instance (database-1).
   - **Connectivity & security** → **Publicly accessible** = **Yes** hona chahiye.
   - Agar **No** hai to **Modify** → **Connectivity** → **Publicly accessible** = Yes → Save. (RDS restart ho sakti hai.)

2. **Security Group – port 5432 allow**
   - Same page par **VPC security groups** mein link par click karo.
   - **Inbound rules** → **Edit inbound rules** → **Add rule**:
     - Type: **PostgreSQL**
     - Port: **5432**
     - Source: **My IP** (recommended) ya testing ke liye **0.0.0.0/0** (sirf test, production mein My IP use karo)
   - Save.

In dono ke baad backend dubara start karo. Agar phir bhi ETIMEDOUT aaye to firewall / office network 5432 block kar raha ho sakta hai.
