import ipaddress
import socket
from urllib.parse import urlparse
from typing import Tuple

def is_ip_private_or_reserved(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        )
    except ValueError:
        return True

def validate_url_against_ssrf(url_str: str) -> Tuple[bool, str]:
    try:
        parsed = urlparse(url_str)
    except Exception:
        return False, "Некорректный формат URL"

    if parsed.scheme not in ("http", "https"):
        return False, "Разрешены исключительно протоколы HTTP и HTTPS"

    hostname = parsed.hostname
    if not hostname:
        return False, "Отсутствует имя хоста"

    # Block well-known internal / metadata hostnames
    lower_host = hostname.lower()
    if lower_host in ("localhost", "127.0.0.1", "::1", "metadata.google.internal", "metadata"):
        return False, "Доступ к локальным адресам и облачным метаданным заблокирован (SSRF Guard)"

    # Resolve IP addresses
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for entry in addr_info:
            ip = entry[4][0]
            if is_ip_private_or_reserved(ip):
                return False, f"Хост {hostname} разрешается в приватный IP {ip} — доступ запрещен (SSRF Guard)"
    except socket.gaierror as e:
        return False, f"Ошибка DNS разрешения: {str(e)}"

    return True, "URL проверен и безопасен"
