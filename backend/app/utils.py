import re
import phonenumbers


class InvalidPhoneError(ValueError):
    pass


class InvalidEmailError(ValueError):
    pass


def normalize_phone(phone: str, default_region: str = None) -> str:
    if not phone or not phone.strip():
        raise InvalidPhoneError("Phone number cannot be empty")
    try:
        parsed = phonenumbers.parse(phone, default_region)
        if not phonenumbers.is_valid_number(parsed):
            raise InvalidPhoneError(f"Invalid phone number: {phone}")
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException as e:
        raise InvalidPhoneError(f"Cannot parse phone number: {phone}") from e


EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def normalize_email(email: str) -> str:
    if not email or not email.strip():
        raise InvalidEmailError("Email cannot be empty")
    cleaned = email.strip().lower()
    if not EMAIL_REGEX.match(cleaned):
        raise InvalidEmailError(f"Invalid email: {email}")
    return cleaned
