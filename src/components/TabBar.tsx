import { NavLink } from 'react-router-dom'
import { BookIcon, FolderIcon, GearIcon, MuseumIcon, ScanIcon } from './Icons'

const TABS = [
  { to: '/', label: 'Музей', Icon: MuseumIcon, end: true },
  { to: '/collections', label: 'Коллекции', Icon: FolderIcon },
  { to: '/scan', label: 'Скан', Icon: ScanIcon },
  { to: '/story', label: 'История', Icon: BookIcon },
  { to: '/settings', label: 'Настройки', Icon: GearIcon },
]

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Разделы">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => 'tab' + (isActive ? ' tab--active' : '')}>
          <Icon width={26} height={26} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
