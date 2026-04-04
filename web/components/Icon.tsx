const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

type Props = {
  name: string
  className?: string
  size?: number
}

export default function Icon({ name, className = '', size = 20 }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${BASE_PATH}/icons/${name}.svg`}
      alt={name}
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}
