import { useCosmos } from '../state/CosmosContext';

export default function Login() {
  const { values: v } = useCosmos();
  return (
    <>
      {v.needsLogin ? (
        <>
          <div
            style={{
              flex: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 16px',
            }}
          >
            <div
              style={{
                width: '340px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '26px',
                borderRadius: '16px',
                border: '1px solid rgba(39,39,42,0.9)',
                background: '#0c0c0e',
                animation: 'popin 180ms ease',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#f4f4f5' }}>{'Connexion'}</div>

              <div style={{ fontSize: '12px', color: '#71717a', lineHeight: '1.6' }}>
                {'Tes données vivent dans ta base. Connecte-toi pour les ouvrir sur cet appareil.'}
              </div>

              <input
                type={'email'}
                value={v.loginEmail ?? ''}
                onChange={v.setLoginEmail}
                onKeyDown={v.loginKey}
                placeholder={'email'}
                autoComplete={'username'}
                style={{
                  background: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: '#f4f4f5',
                }}
              />

              <input
                type={'password'}
                value={v.loginPassword ?? ''}
                onChange={v.setLoginPassword}
                onKeyDown={v.loginKey}
                placeholder={'mot de passe'}
                autoComplete={'current-password'}
                style={{
                  background: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: '#f4f4f5',
                }}
              />

              {v.hasLoginError ? (
                <>
                  <div
                    style={{
                      padding: '9px 12px',
                      borderRadius: '10px',
                      background: 'rgba(244,63,94,0.1)',
                      fontSize: '12px',
                      color: '#fb7185',
                      lineHeight: '1.5',
                    }}
                  >
                    {v.loginError}
                  </div>
                </>
              ) : null}

              <button
                onClick={v.doLogin}
                style={{
                  background: '#fafafa',
                  color: '#09090b',
                  border: 'none',
                  padding: '10px 15px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  opacity: v.loginBtnOpacity,
                }}
                className={'cosmos-hover-17'}
              >
                {v.loginLabel}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
