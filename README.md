# baim

## Przygotowanie środowiska
Preferowany system to Ubuntu, Debian, Kali lub inny system bazujący na menadżerze pakietów APT. Można też robić na Windowsie, ale nie oferuję pomocy w takim przypadku.

Najpierw musimy sklonować to repo: `git clone https://github.com/majudev/baim` lub [pobierać wersję .zip](https://codeload.github.com/majudev/baim/zip/refs/heads/master)

Potem trzeba [zainstalować VS Code](https://code.visualstudio.com/) (lub dowolny inny edytor).

Na koniec [instalujemy nodejs](https://nodejs.org/en/download).

W VS Code klikamy `Plik -> Otwórz folder...` i wybieramy folder naszego repo. Na dole VS Code mamy opcję Terminal. Otwieramy go i wpisujemy komendę `npm install`, potem czekamy aż pobiorą się zależności. Żeby uruchomić serwer wpisujemy `npm run start`. Po każdej zmianie kodu musimy zabić ten proces przez Ctrl+C i uruchomić go ponownie.

Musimy też mieć sprawne narzędzie curl, które jest dostępne na Windowsie i większości Linuxów od razu.

## Zadanie 1 - brute forcing Basic Auth

### Przygotowanie
1. Pobierz THC Hydra
   - Windows
     1. [Pobieramy](https://github.com/maaaaz/thc-hydra-windows/releases/download/v9.1/thc-hydra-windows-v9.1.zip) i wypakowujemy
     2. Otwieramy `cmd` i wchodzimy do folderu w którym wypakowaliśmy hydrę
     3. Jeśli w terminalu działa poleceni `hydra` to jest ok
   - Linux
     1. `sudo apt install hydra`
     2. Jeśli działa polecenie `hydra` to jest ok
2. Pobierz słownik RockYou.txt
   - Wersja skompresowana (50MB): [link](https://github.com/praetorian-inc/Hob0Rules/raw/master/wordlists/rockyou.txt.gz) - na Windowsie trzeba mieć zainstalowany 7zip żeby rozpakować, na linuxie przez `gzip -d rockyou.txt.gz`
   - Wersja nieskompresowana (114 MB): [link](https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt) - jeśli masz Windowsa bez 7zip to użyj tego linku
3. Kopiujemy plik rockyou.txt do folderu z hydrą

### Sprawdzenie które endpointy są dostępne
Na naszym serwerze dostępne są następujące endpointy:
- GET /static/version
- GET /auth/protected

Adres serwera to `http://localhost:9030/`.

Używając komendy `curl` sprawdź które z nich są dostępne bez hasła. Podpowiedź: `curl -vvv (...)` wyświetli dużo więcej szczegółów niż samo `curl`.

Wejdź na endpointy `/static/version` i `/auth/protected` przez przeglądarkę. Na jednym z nich wyskakuje pop-up.

Curl pokazuje nam w nagłówkach odpowiedzi `WWW-Authenticate: Basic (...)`. Przeglądarka również wyświetla pop-up jak dla basic auth.

### Atak
Naszym endpointem do ataku będzie `/auth/protected`. Spróbujemy złamać hasło używając słownika `rockyou.txt`.

1. Uruchamiamy Hydrę: `hydra -l admin -P rockyou.txt -s 9030 -f localhost -m /auth/protected http-get`
   - `-l admin` - szukamy hasła dla użytkownika admin
   - `-P rockyou.txt` - szukamy hasła w słowniku rockyou.txt
   - `-s 9030` - port 9030
   - `-f localhost` - host localhost
   - `-m /auth/protected` - endpoint który atakujemy
   - `http-get` - używamy metody HTTP GET. Jakbyśmy atakowali endpoint przez HTTPS, to byśmy użyli `https-get`
2. Czekamy aż hasło się zcrackuje. Co minutę program wyświetla linijkę `[STATUS] 9139.00 tries/min` z ilością prób na minutę. Przy prędkości ~9000 prób/min crackowanie zajmuje 3 minuty.
3. Gdy hasło zostanie znalezione, program wyświetli komunikat:
`[9030][http-get] host: localhost   login: admin   password: XXXXXX`

Jakie było hasło do konta `admin`? Znajdź w kodzie źródłowym fragment w którym jest ono zapisane.

## Zadanie 2 - rate limiting
Spróbujemy uniemożliwić przeprowadzenie powyższego ataku.

### Obsługa tras w ExpressJS
ExpressJS używa do obsługi endpointów tzw. middlewares. Zapytanie przechodzi po kolei przez każde middleware. Middleware może przesłać zapytanie do kolejnego middleware, lub zwrócić odpowiedź (np. poinformować o błędzie) i przerwać ten łańcuch wywołań.

Przykładowo:
```javascript
import staticRouter from './static';
app.options('/static');
app.use('/static', staticRouter);
```
W tym przykładzie `staticRouter` jest middleware, które odpowiada za obsługę tego endpointu. Gdy otworzymy plik `./static.ts` możemy zobaczyć jak ona wygląda.

Natomiast w przykładzie
```javascript
import authRouter from './auth';
app.options('/auth');
app.use('/auth', basicAuth({
	users: { 'admin': 'fantastic4' },
	challenge: true,
    realm: 'BAIM',
}), authRouter);
```
używamy dwóch middlewares. Pierwsze to `basicAuth`. Drugie to `authRouter`. `authRouter` działa tak samo jak `staticRouter` z poprzedniego przykładu. Natomiast `basicAuth` sprawdza czy podaliśmy prawidłowe dane logowania. Jeśli tak - przekazuje dane do kolejnego middleware. Jeśli nie - zwraca kod HTTP 401 i przerywa ciąg wywołań middlewares.

Możemy wyobrazić sobie sytuację w której chcemy zbanować konkretne adresy IP. Wtedy stworzymy middleware które sprawdzi czy zapytanie pochodzi od jednego z zabronionych adresów. Kolejne middleware może np. sprawdzać ciasteczka, kolejne wypisać dane do konsoli w formie logów, a dopiero ostatnie będzie zajmować się właściwym działaniem endpointu.

### Używamy middleware express-rate-limit
Mamy już zainstalowaną paczkę `express-rate-limit`. Zabezpiecz wszystkie endpointy zaczynające się od `/auth` tym rate limitingiem.

Przykładowy kod:
```javascript
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
});

// Apply the rate limiting middleware to all endpoints beginning with /static
app.use('/static', limiter, staticRouter);
```

Zabezpiecz endpointy zaczynające się od `/auth`, tak aby przez 15 minut dany adres IP mógł wykonać tylko 100 zapytań.

