````markdown
## 🏷️ Feature: White Label por Cliente

### Visão geral

O site passará a suportar **white label dinâmico**, carregando a identidade visual de cada cliente a partir do momento do login.

---

### Como funciona

```json
{
  "feature": "White Label",
  "trigger": "Login do cliente",
  "fonte_de_dados": "Tabela `branding` via OCPP/API",

  "fluxo": {
    "1_verificacao": "Ao fazer login, o sistema consulta a tabela `branding` pelo identificador do cliente",
    "2_cliente_encontrado": {
      "acao": "Carrega identidade visual do cliente",
      "dados_aplicados": ["logo", "nome", "cor_primaria"]
    },
    "3_cliente_nao_encontrado": {
      "acao": "Carrega identidade visual padrão",
      "dados_aplicados": ["logo NeoPower", "nome NeoPower", "cores padrão NeoPower"]
    }
  },

  "tabela_branding": {
    "descricao": "Tabela que armazena as configurações visuais por cliente",
    "campos_esperados": ["client_id", "logo_url", "nome", "cor_primaria"]
  },

  "estado_atual": "API OCPP já retorna logo, nome e cor primária por cliente",
  "estado_alvo": "Site consome esses dados e aplica o tema visual dinamicamente desde o login"
}
```

---

### Regra de negócio

| Condição | Comportamento |
|---|---|
| Cliente existe na tabela `branding` | Aplica tema do cliente (logo + nome + cor) |
| Cliente **não** existe na tabela `branding` | Aplica tema padrão NeoPower |

---

### Dependências

- API OCPP já exposta com os campos de branding por cliente
- Tabela `branding` populada para os clientes que terão tema próprio
- Aplicação do tema deve ocorrer **antes ou durante** a renderização pós-login
````