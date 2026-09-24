const glados = async () => {
  const notice = []
  if (!process.env.GLADOS) return
  for (const cookie of String(process.env.GLADOS).split('\n')) {
    if (!cookie) continue
    try {
      const common = {
        'cookie': cookie,
        'referer': 'https://glados.cloud/console/checkin',
        'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)',
      }
      const action = await fetch('https://glados.cloud/api/user/checkin', {
        method: 'POST',
        headers: { ...common, 'content-type': 'application/json' },
        body: '{"token":"glados.cloud"}',
      }).then((r) => r.json())
      if (action?.code) throw new Error(action?.message)
      const status = await fetch('https://glados.cloud/api/user/status', {
        method: 'GET',
        headers: { ...common },
      }).then((r) => r.json())
      if (status?.code) throw new Error(status?.message)
      notice.push(
        'Checkin OK',
        `${action?.message}`,
        `Left Days ${Number(status?.data?.leftDays)}`
      )
    } catch (error) {
      notice.push(
        'Checkin Error',
        `${error}`,
        `<${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}>`
      )
    }
  }
  return notice
}

const railgun = async () => {
  const notice = []
  if (!process.env.RAILGUN) return
  for (const cookie of String(process.env.RAILGUN).split('\n')) {
    if (!cookie) continue
    try {
      const common = {
        'cookie': cookie,
        'referer': 'https://railgun.info/console/checkin',
        'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)',
      }
      const action = await fetch('https://railgun.info/api/user/checkin', {
        method: 'POST',
        headers: { ...common, 'content-type': 'application/json' },
        body: '{"token":"railgun.info"}',
      }).then((r) => r.json())
      if (action?.code) throw new Error(action?.message)
      const status = await fetch('https://railgun.info/api/user/status', {
        method: 'GET',
        headers: { ...common },
      }).then((r) => r.json())
      if (status?.code) throw new Error(status?.message)
      notice.push(
        'Checkin OK',
        `${action?.message}`,
        `Left Days ${Number(status?.data?.leftDays)}`
      )
    } catch (error) {
      notice.push(
        'Checkin Error',
        `${error}`,
        `<${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}>`
      )
    }
  }
  return notice
}

const starnetcn = async () => {
  const notice = []
  if (!process.env.STARNETCN) return
  // 该站会按 User-Agent 拦截非现代浏览器（重写到“请在浏览器中打开”HTML 页），
  // 必须使用现代浏览器 UA，且认证为 authorization 头携带原始 JWT（无 Bearer 前缀）
  const common = {
    'authorization': '',
    'content-type': 'application/json',
    'accept': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    'referer': 'https://www.starnetcn.com/checkin',
  }
  const parseJson = async (res) => {
    const data = await res.json().catch(() => null)
    // 护栏：被拦截时会返回 200 + HTML，json 解析为 null，必须识别为失败而非假成功
    if (!data || typeof data !== 'object' || typeof data.data !== 'object' || data.data === null) {
      throw new Error(`Invalid response (HTTP ${res.status}, blocked or not JSON)`)
    }
    return data
  }
  for (const tokenRaw of String(process.env.STARNETCN).split('\n')) {
    const token = tokenRaw.trim()
    if (!token) continue
    try {
      const headers = { ...common, 'authorization': token }
      // 与官网流程一致：先 GET info，已签到则不再 claim
      const infoRes = await fetch('https://www.starnetcn.com/api/v1/user/checkin/info', {
        method: 'GET',
        headers,
      })
      if (!infoRes.ok) {
        const errBody = await infoRes.json().catch(() => ({}))
        throw new Error(errBody?.message || errBody?.error || `HTTP ${infoRes.status}`)
      }
      const info = await parseJson(infoRes)
      if (info.data.enable === false) {
        notice.push('Checkin Skip', 'Checkin disabled by site')
        continue
      }
      let result = info.data
      let already = info.data.checked_in === true
      if (!already) {
        const claimRes = await fetch('https://www.starnetcn.com/api/v1/user/checkin/claim', {
          method: 'POST',
          headers,
          body: '{}',
        })
        if (!claimRes.ok) {
          const errBody = await claimRes.json().catch(() => ({}))
          throw new Error(errBody?.message || errBody?.error || `HTTP ${claimRes.status}`)
        }
        const claim = await parseJson(claimRes)
        result = claim.data
        // 只认 already_checked_in：claim 成功后 checked_in 恒为 true（当前已签状态），不能用作“重复”判据
        already = claim.data.already_checked_in === true
      }
      const rewardGb = Number(result.reward_gb ?? result.last_checkin?.reward_gb)
      notice.push(
        'Checkin OK',
        already ? 'Already Checked In' : 'Checkin Success',
        `Reward ${rewardGb} GB`
      )
    } catch (error) {
      notice.push(
        'Checkin Error',
        `${error}`,
        `<${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}>`
      )
    }
  }
  return notice
}

const notify = async (notice) => {
  if (!process.env.NOTIFY || !notice) return
  for (const option of String(process.env.NOTIFY).split('\n')) {
    if (!option) continue
    try {
      if (option.startsWith('console:')) {
        for (const line of notice) {
          console.log(line)
        }
      } else if (option.startsWith('wxpusher:')) {
        const wxRes = await fetch('https://wxpusher.zjiecode.com/api/send/message/simple-push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            summary: notice[0],
            content: notice.join('<br>'),
            contentType: 3,
            spt: option.split(':')[1],
          }),
        })
        const wxData = await wxRes.json().catch(() => ({}))
        if (!wxRes.ok || wxData?.success === false) {
          throw new Error(`wxpusher ${wxData?.code ?? wxRes.status}: ${wxData?.msg || 'request failed'}`)
        }
      } else if (option.startsWith('pushplus:')) {
        await fetch('https://www.pushplus.plus/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: option.split(':')[1],
            title: notice[0],
            content: notice.join('<br>'),
            template: 'markdown',
          }),
        })
      } else if (option.startsWith('qyweixin:')) {
        const qyweixinToken = option.split(':')[1]
        const qyweixinNotifyRebotUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + qyweixinToken
        await fetch(qyweixinNotifyRebotUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'markdown',
            markdown: {
                content: notice.join('<br>')
            }
          }),
        })
      } else {
        // fallback
        await fetch('https://www.pushplus.plus/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: option,
            title: notice[0],
            content: notice.join('<br>'),
            template: 'markdown',
          }),
        })
      }
    } catch (error) {
      console.error(`Notify Error [${option.split(':')[0]}]:`, error)
    }
  }
}

const main = async () => {
  await notify(await glados())
  await notify(await railgun())
  await notify(await starnetcn())
}

main()
