import { useEffect } from 'react'

interface SpeechButtonProps {
  text: string
}

const speechIsSupported = () =>
  typeof window !== 'undefined' &&
  typeof window.speechSynthesis !== 'undefined' &&
  typeof SpeechSynthesisUtterance !== 'undefined'

export function SpeechButton({ text }: SpeechButtonProps) {
  const supported = speechIsSupported()

  useEffect(() => {
    const synthesis = speechIsSupported() ? window.speechSynthesis : null

    return () => synthesis?.cancel()
  }, [text])

  const speak = () => {
    if (!speechIsSupported()) {
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    window.speechSynthesis.speak(utterance)
  }

  return (
    <button
      type="button"
      className="quiet-button ui-button ui-button--secondary"
      disabled={!supported}
      aria-label={
        supported ? '朗读当前知识卡' : '当前浏览器不支持朗读'
      }
      onClick={speak}
    >
      朗读内容
    </button>
  )
}
