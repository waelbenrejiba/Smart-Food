# SmartFood backend

Django REST API for the Angular application. The API uses SQLite for local development and listens on port `8000`.

## Setup (Windows PowerShell)

From the repository root:

```powershell
py -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python backend\manage.py migrate
python backend\manage.py runserver 127.0.0.1:8000
```

The first command creates a virtual environment just for Django; it does not change the Angular dependencies. If PowerShell blocks activation, run the commands using `backend\.venv\Scripts\python.exe` instead of `python`.

Angular should be running at `http://127.0.0.1:4200` or `http://localhost:4200`. Both origins are allowed by the local CORS configuration.

## API

- `POST /api/users/register/` — create a consumer, chef, or association account.
- `POST /api/auth/login/` — exchange `username` and `password` for JWT `access` and `refresh` tokens.
- `POST /api/auth/refresh/` — exchange a refresh token for a new access token.
- `GET /api/users/me/` — return the authenticated user's profile; send `Authorization: Bearer <access>`.
- `POST /api/offers/` — chef-only: publish a donation offer with `product`, `category`, `quantity`, `unit`, `expiration_date`, and optional `location`.
- `GET /api/offers/` — association-only: list donation offers and the current association's response status.
- `POST /api/offers/<id>/respond/` — association-only: submit `{"status": "accepted"}` or `{"status": "refused"}`. Each association can respond once to each offer; its response does not change what other associations see.
- `/admin/` — Django administration.

Registration expects `username`, `email`, `password`, `first_name`, `last_name`, and `role`. Valid self-registration roles are `CONSUMER`, `CHEF`, and `ASSOCIATION`; administrator accounts must be created by an administrator.

The association dashboard loads real offers from the API and saves accept/refuse actions. Donation offers are persisted in SQLite. The existing chef inventory is still local demo data; its offers can be created through the authenticated API but are not yet submitted from the chef screen.

## Tests

```powershell
python backend\manage.py test accounts
```

The checked-in secret key and `DEBUG` default are for local development only. Set `DJANGO_SECRET_KEY` to a private value and `DJANGO_DEBUG=false` before deploying.
