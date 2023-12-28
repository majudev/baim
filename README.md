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
- POST /posts/v1
- GET /posts/v1
- DELETE /posts/v1/:postId

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

## Zadanie 3 - używanie ORM
Większość problemów z bezpieczeństwem wynika z pomyłek programistów. Im bardziej nasz framework chroni nas przed prostymi pomyłkami, tym mniejsza szansa że popełnimy błąd, a co za tym idzie - tym większe bezpieczeństwo aplikacji. **Używanie ORM samo w sobie nie zwiększa bezpieczeństwa naszej aplikacji**, ale ponieważ oferuje mechanizm automatycznej serializacji i deserializacji, warto zdecydować się na to rozwiązanie aby uniknąć wprowadzania bugów. A co za tym idzie - pośrednio zwiększyć bezpieczeństwo aplikacji.

My jako nasz ORM użyjemy [Prisma](https://www.prisma.io/).

### Jak wygląda API do obsługi postów
Aktualnie do obsługi postów mamy następujące endpointy:
- POST /posts/v1 - tworzy posta z zawartością podaną w body zapytania
- GET /posts/v1 - wyświetla wszystkie posty
- DELETE /posts/v1/:postId - usuwa posta o danym ID

Możemy przestestować nasze API w następujący sposób:
```bash
curl -vvv -X POST http://localhost:9030/posts/v1 -H 'Content-Type: text/plain' --data 'Zawartość posta'
curl -vvv -X GET http://localhost:9030/posts/v1
curl -vvv -X DELETE http://localhost:9030/posts/v1/[id dowolnego posta z poprzedniej komendy]
curl -vvv -X GET http://localhost:9030/posts/v1
```

Naszym zadaniem będzie najpierw przeprowadzić atak, a potem załatać podatność poprzez użycie ORM zamiast surowych zapytań SQL.

### Atak
Dodajmy kilka postów.
```bash
curl -vvv -X POST http://localhost:9030/posts/v1 -H 'Content-Type: text/plain' --data 'Post Nummer eins'
curl -vvv -X POST http://localhost:9030/posts/v1 -H 'Content-Type: text/plain' --data 'Post Nummer zwei'
curl -vvv -X POST http://localhost:9030/posts/v1 -H 'Content-Type: text/plain' --data 'Post Nummer drei'
curl -vvv -X GET http://localhost:9030/posts/v1
```

Spróbujmy zrobić SQL Injection, które skasuje wszystkie posty z bazy danych.
```bash
curl -vvv -X POST http://localhost:9030/posts/v1 -H 'Content-Type: text/plain' --data "xxx'); DELETE FROM \"Post\"; -- Zawartość posta"
curl -vvv -X GET http://localhost:9030/posts/v1
```

Posty zostały skasowane. Niedobrze, bardzo niedobrze...

### Jak zainstalować Prisma
Zaczynamy od zainstalowania Prisma.

```bash
npx prisma init --datasource-provider sqlite
```

Otwieramy nowo stworzony plik `.env` i zastępujemy linijkę
```
DATABASE_URL="file:./dev.db"
```
na
```
DATABASE_URL="file:../database.db"
```
W ten sposób Prisma będzie używać bazy danych którą już mamy.

Teraz musimy "zassać" bazę danych do Prismy, tak żeby wiedziała jak wygenerować kod JavaScript odpowiedni do tego co w niej mamy. Na szczęście można to zrobić jedną komendą: 
```bash
npx prisma db pull
```

Otwórz plik `prisma/schema.prisma` i zobacz że jest w nim pseudo-SQL który odpowiada zawartości naszej bazy danych.

Teraz musimy poprosić Prismę o wygenerowanie odpowiednich bibliotek JavaScript:
```bash
npx prisma generate
```

W tym momencie Prisma jest gotowa do użycia.

### Implementacja Prismy
Stworzymy endpointy działajace identycznie do /v1 ale z nazwą /v2, czyli
- POST /posts/v2 - tworzy posta z zawartością podaną w body zapytania
- GET /posts/v2 - wyświetla wszystkie posty
- DELETE /posts/v2/:postId - usuwa posta o danym ID

Zaczynamy od dodania w każdym pliku w którym będziemy używać Prismy tych linijek na początku pliku:
```javascript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
```
W naszym przypadku jest to plik `posts.ts`.

Zauważ, że po wpisaniu `prisma.` VS Code sam podpowie nam składnie. Ponieważ pracujemy na obiekcie Post, właściwą składnią jest `prisma.post.` - nazwy metod są intuicyjne, na pewno sobie poradzisz. Dokumentacja jest dostępna na stronie Prismy.

Przykładowe implementacje:
```javascript
router.post('/v2', bodyParser.text({type: 'text/plain'}), async (req: Request, res: Response) => {
    try{
        const postContent = req.body as string;
        logger.info('postContent: ' + JSON.stringify(postContent));
        const newPost = await prisma.post.create({
            data: {
                postContent: postContent,
            },
            select: {
                postContent: true,
            }
        });
        res.status(200).json({
            status: "success",
            postContent: newPost.postContent,
        });
    }catch(e){
        res.status(500).json({
            status: "error",
            details: JSON.stringify(e),
        });
    }
});

router.get('/v2', async (req: Request, res: Response) => {
    try{
        const allPosts = await prisma.post.findMany({

        });
        res.status(200).json({
            status: "success",
            posts: allPosts,
        });
    }catch(e){
        res.status(500).json({
            status: "error",
            details: JSON.stringify(e),
        });
    }
});

router.delete('/v2/:postId', async (req: Request, res: Response) => {
    try{
        const postId = Number.parseInt(req.params.postId);
        
        await prisma.post.delete({
            where: {
                postId: postId,
            }
        });

        res.status(204).end();
    }catch(e){
        res.status(500).json({
            status: "error",
            details: JSON.stringify(e),
        });
    }
});
```

Jeśli wszystko zrobiłeś poprawnie, to ataki z poprzedniego punktu nie powinny tym razem zadziałać.